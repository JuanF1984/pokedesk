// Generates and caches a spoken MP3 summary (name + types + Spanish
// description, mirroring the /api/pokemon/[id]?display=tft payload) for a
// Pokemon, meant for the CYD to download over Wi-Fi and store on the
// microSD at /pokemon/audio/{id}.mp3.
//
// TTS runs through the Vercel AI Gateway (openai/tts-1). Results are cached
// in Vercel Blob keyed by a hash of the final spoken text, so the same
// audio is never regenerated unless the underlying description changes.
export const runtime = "nodejs";

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

function blobPathname(id, text) {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  return `pokemon/audio/${id}-${hash}.mp3`;
}

// Returns the cached MP3 bytes, or null on a cache miss / read failure —
// either way the caller falls back to regenerating via TTS.
async function readCachedAudio(pathname) {
  let meta;
  try {
    meta = await head(pathname);
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) {
      console.error("[pokemon/audio] blob head failed:", err?.message ?? err);
    }
    return null;
  }

  try {
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[pokemon/audio] cached blob fetch failed:", err?.message ?? err);
    return null;
  }
}

async function generateAudio(text) {
  const { audio } = await generateSpeech({
    model: gateway.speech(SPEECH_MODEL),
    text,
    voice: SPEECH_VOICE,
    outputFormat: "mp3",
  });
  return Buffer.from(audio.uint8Array);
}

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing pokemon id" }, { status: 400 });
  }

  let audioText;
  try {
    audioText = await buildPokemonAudioText(id);
  } catch (err) {
    if (err instanceof PokemonNotFoundError) {
      return Response.json({ error: "Pokemon not found" }, { status: 404 });
    }
    if (err instanceof PokemonDescriptionUnavailableError) {
      return Response.json({ error: "Description unavailable" }, { status: 502 });
    }
    if (err instanceof PokemonUpstreamError) {
      return Response.json({ error: "Upstream error" }, { status: 502 });
    }
    console.error("[pokemon/audio] failed to build audio text:", err?.message ?? err);
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }

  const pathname = blobPathname(audioText.id, audioText.text);

  let mp3 = await readCachedAudio(pathname);
  let cacheStatus = mp3 ? "HIT" : "MISS";
  console.log(`[pokemon/audio] id=${audioText.id} cache=${cacheStatus} pathname=${pathname}`);

  if (!mp3) {
    try {
      mp3 = await generateAudio(audioText.text);
    } catch (err) {
      console.error("[pokemon/audio] TTS generation failed:", err?.message ?? err);
      return Response.json({ error: "TTS provider failed" }, { status: 502 });
    }

    try {
      await put(pathname, mp3, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "audio/mpeg",
      });
    } catch (err) {
      // Cache write failing must not break the response — the CYD still
      // gets a valid MP3, just regenerated on the next request too.
      console.error("[pokemon/audio] cache write failed:", err?.message ?? err);
    }
  }

  return new Response(mp3, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": mp3.length.toString(),
      "Cache-Control": "public, max-age=604800, immutable",
      // Diagnostic only (not relied on by the CYD): confirms whether this
      // response was served from the Vercel Blob cache or freshly
      // generated via TTS.
      "X-Audio-Cache": cacheStatus,
    },
  });
}
