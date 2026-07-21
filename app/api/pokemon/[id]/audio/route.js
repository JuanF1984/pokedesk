// Generates and caches a spoken MP3 summary (name + types + Spanish
// description, mirroring the /api/pokemon/[id]?display=tft payload) for a
// Pokemon, meant for the CYD to download over Wi-Fi and store on the
// microSD at /pokemon/audio/{id}.mp3.
//
// TTS runs through the Vercel AI Gateway (openai/tts-1). Results are cached
// in Vercel Blob keyed by a hash of the final spoken text, so the same
// audio is never regenerated unless the underlying description changes.
export const runtime = "nodejs";

// Conservative and valid on every current Vercel plan tier (Hobby's own
// ceiling allows configuring up to 60s) -- not verified against this
// project's actual plan, since that isn't readable from the repo. Raise it
// only after confirming the real limit on the dashboard.
export const maxDuration = 30;

import { createHash } from "crypto";
import { head, put, BlobNotFoundError } from "@vercel/blob";
import { generateSpeech, gateway } from "ai";
import {
  buildPokemonAudioText,
  PokemonNotFoundError,
  PokemonUpstreamError,
  PokemonDescriptionUnavailableError,
} from "@/lib/pokemonAudioText";

const SPEECH_MODEL = "openai/tts-1";
const SPEECH_VOICE = "alloy";

// Hard deadline for the TTS call itself, well under maxDuration above: the
// PokeAPI fetches (buildPokemonAudioText) and the Blob head/put still need
// their share of the remaining time, and we want to abort and answer
// ourselves before Vercel kills the function with no readable body.
const TTS_TIMEOUT_MS = 20000;

// One retry beyond the initial attempt (the SDK's own default is 2): bounds
// the worst-case latency before our timeout fires, while still tolerating
// a single transient provider error.
const TTS_MAX_RETRIES = 1;

const LOG_PREFIX = "[AUDIO]";

// err?.message only, never the raw error object: some HTTP client errors
// carry request headers (which could include auth) in other properties.
function log(tag, id, message) {
  console.log(`${LOG_PREFIX} ${tag} id=${id} ${message}`);
}

function logError(id, message, err) {
  console.error(`${LOG_PREFIX} Error id=${id} ${message}: ${err?.message ?? err}`);
}

function blobPathname(id, text) {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  return `pokemon/audio/${id}-${hash}.mp3`;
}

// Returns the cached MP3 bytes, or null on a cache miss / read failure --
// either way the caller falls back to regenerating via TTS.
async function readCachedAudio(id, pathname) {
  let meta;
  try {
    meta = await head(pathname);
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) {
      logError(id, "blob head failed", err);
    }
    return null;
  }

  try {
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    logError(id, "cached blob fetch failed", err);
    return null;
  }
}

// In-flight generations keyed by Blob pathname, scoped to this function
// instance. Lets concurrent requests for the same Pokemon (same id + same
// text -> same hash) share a single TTS call instead of each paying for its
// own. Does NOT cover multiple/cold instances or regions -- that would need
// a distributed lock, out of scope for this fix.
const inFlightGenerations = new Map();

async function generateAudioOnce(text, signal) {
  const { audio } = await generateSpeech({
    model: gateway.speech(SPEECH_MODEL),
    text,
    voice: SPEECH_VOICE,
    outputFormat: "mp3",
    maxRetries: TTS_MAX_RETRIES,
    abortSignal: signal,
  });

  const mp3 = Buffer.from(audio.uint8Array);
  if (mp3.length === 0) {
    // Defensive: generateSpeech() already throws NoSpeechGeneratedError if
    // the provider returns empty audio, but this doesn't depend on that
    // SDK behavior staying the same.
    throw new Error("TTS provider returned empty audio");
  }
  return mp3;
}

// Returns { promise, signal } instead of just the promise so the caller can
// check signal.aborted after awaiting -- including a caller that joined an
// already-in-flight generation it didn't start itself.
function generateAudioDeduped(pathname, text) {
  const existing = inFlightGenerations.get(pathname);
  if (existing) return existing;

  const signal = AbortSignal.timeout(TTS_TIMEOUT_MS);
  const promise = generateAudioOnce(text, signal).finally(() => {
    inFlightGenerations.delete(pathname);
  });

  const entry = { promise, signal };
  inFlightGenerations.set(pathname, entry);
  return entry;
}

export async function GET(request, { params }) {
  const startedAt = Date.now();
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing pokemon id" }, { status: 400 });
  }

  const dataStartedAt = Date.now();
  let audioText;
  try {
    audioText = await buildPokemonAudioText(id);
  } catch (err) {
    if (err instanceof PokemonNotFoundError) {
      return Response.json({ error: "Pokemon not found" }, { status: 404 });
    }
    if (err instanceof PokemonDescriptionUnavailableError) {
      // Not an upstream/gateway failure -- PokeAPI answered fine, there's
      // just no describable content for this id. 404, not 502.
      return Response.json(
        { error: "No description available for audio" },
        { status: 404 }
      );
    }
    if (err instanceof PokemonUpstreamError) {
      logError(id, "upstream error building audio text", err);
      return Response.json({ error: "Upstream error" }, { status: 502 });
    }
    logError(id, "unexpected error building audio text", err);
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }
  const dataMs = Date.now() - dataStartedAt;

  const pathname = blobPathname(audioText.id, audioText.text);

  const cacheStartedAt = Date.now();
  let mp3 = await readCachedAudio(audioText.id, pathname);
  const cacheStatus = mp3 ? "HIT" : "MISS";
  const cacheMs = Date.now() - cacheStartedAt;

  log(cacheStatus, audioText.id, `pathname=${pathname} dataMs=${dataMs} cacheMs=${cacheMs}`);

  let ttsMs = 0;
  let blobMs = 0;

  if (!mp3) {
    log("Generando", audioText.id, `pathname=${pathname}`);
    const ttsStartedAt = Date.now();
    const entry = generateAudioDeduped(pathname, audioText.text);

    try {
      mp3 = await entry.promise;
    } catch (err) {
      ttsMs = Date.now() - ttsStartedAt;
      if (entry.signal.aborted) {
        logError(audioText.id, `TTS timeout after ${ttsMs}ms`, err);
        return Response.json({ error: "TTS provider timeout" }, { status: 504 });
      }
      logError(audioText.id, `TTS generation failed after ${ttsMs}ms`, err);
      return Response.json({ error: "TTS provider failed" }, { status: 502 });
    }
    ttsMs = Date.now() - ttsStartedAt;

    const blobStartedAt = Date.now();
    try {
      await put(pathname, mp3, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "audio/mpeg",
      });
      blobMs = Date.now() - blobStartedAt;
      log("Guardado", audioText.id, `pathname=${pathname} bytes=${mp3.length} blobMs=${blobMs}`);
    } catch (err) {
      blobMs = Date.now() - blobStartedAt;
      // Cache write failing must not break the response -- the CYD/web
      // client still gets a valid MP3, just regenerated on the next MISS.
      logError(audioText.id, "cache write failed", err);
    }
  }

  const totalMs = Date.now() - startedAt;
  log(
    "Total",
    audioText.id,
    `cache=${cacheStatus} dataMs=${dataMs} cacheMs=${cacheMs} ttsMs=${ttsMs} blobMs=${blobMs} totalMs=${totalMs}`
  );

  return new Response(mp3, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": mp3.length.toString(),
      "Cache-Control": "public, max-age=604800, immutable",
      "X-Audio-Cache": cacheStatus,
    },
  });
}
