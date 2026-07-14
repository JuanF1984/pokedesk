// Bitmap generation (Sharp) is loaded lazily and defensively inside
// lib/spriteBitmap.js: any failure there (missing platform binary, bad
// sprite data, etc.) must never crash this route or take down the base
// { name, type } response.
export const runtime = "nodejs";

import { buildBitmapFromSprite } from "@/lib/spriteBitmap";
import { capitalize } from "@/lib/api";
import { TYPE_NAMES_ES } from "@/lib/typeNames";

const MIN_SIZE = 8;
const MAX_SIZE = 64;
const DEFAULT_SIZE = 48;

// Maps PokeAPI's hyphenated stat names to the camelCase keys the TFT client expects.
const STAT_KEY_BY_NAME = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function buildBitmap(spriteUrl, width, height, debug) {
  let spriteRes;
  try {
    spriteRes = await fetch(spriteUrl);
  } catch (err) {
    console.error("[pokemon/bitmap] sprite fetch failed:", err?.message ?? err);
    return null;
  }
  if (!spriteRes.ok) return null;

  try {
    const spriteBuffer = Buffer.from(await spriteRes.arrayBuffer());
    return await buildBitmapFromSprite(spriteBuffer, width, height, { debug });
  } catch (err) {
    console.error("[pokemon/bitmap] processing failed:", err?.message ?? err);
    return null;
  }
}

// Non-fatal: the TFT response degrades to description: "" rather than failing
// the whole request if the species endpoint is slow/down.
async function fetchSpeciesDescription(speciesUrl) {
  try {
    const res = await fetch(speciesUrl);
    if (!res.ok) return null;
    const species = await res.json();
    const entries = species.flavor_text_entries ?? [];
    const esEntries = entries.filter((e) => e.language.name === "es");
    const chosen = (esEntries.length > 0 ? esEntries : entries.filter((e) => e.language.name === "en"))[0];
    if (!chosen) return null;
    return chosen.flavor_text.replace(/[\f\n\r]+/g, " ").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("[pokemon/tft] species fetch failed:", err?.message ?? err);
    return null;
  }
}

function buildStats(statsArray) {
  const stats = {};
  for (const s of statsArray) {
    const key = STAT_KEY_BY_NAME[s.stat.name];
    if (key) stats[key] = s.base_stat;
  }
  return stats;
}

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing pokemon id" }, { status: 400 });
  }

  const { searchParams, origin } = new URL(request.url);
  const display = searchParams.get("display");

  let response;
  try {
    response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  } catch {
    return Response.json({ error: "Network error" }, { status: 500 });
  }

  if (response.status === 404) {
    return Response.json({ error: "Pokemon not found" }, { status: 404 });
  }

  if (!response.ok) {
    return Response.json({ error: "Upstream error" }, { status: 500 });
  }

  const data = await response.json();

  // Lightweight JSON for the ESP32 TFT client: no embedded bitmap, image is
  // served separately by /api/pokemon/[id]/image.
  if (display === "tft") {
    const description = await fetchSpeciesDescription(data.species.url);
    return Response.json({
      id: data.id,
      name: data.name,
      displayName: capitalize(data.name),
      types: data.types.map((t) => ({
        name: t.type.name,
        nameEs: TYPE_NAMES_ES[t.type.name] ?? t.type.name,
      })),
      height: Number((data.height / 10).toFixed(1)),
      weight: Number((data.weight / 10).toFixed(1)),
      description: description ?? "",
      stats: buildStats(data.stats),
      imageUrl: `${origin}/api/pokemon/${data.id}/image`,
    });
  }

  const width = clamp(parseInt(searchParams.get("w"), 10) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const height = clamp(parseInt(searchParams.get("h"), 10) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  // ?debug=1 attaches the losing candidates' scores alongside the winning
  // strategy, for comparing strategies on a live sprite. Never part of the
  // default response shape.
  const debug = searchParams.get("debug") === "1";
  const spriteUrl = data.sprites?.front_default;

  let bitmap = null;
  if (spriteUrl) {
    try {
      bitmap = await buildBitmap(spriteUrl, width, height, debug);
    } catch (err) {
      // Last-resort net: buildBitmap already catches its own errors, but the
      // bitmap feature must never be able to take down the base response.
      console.error("[pokemon/bitmap] unexpected failure:", err?.message ?? err);
      bitmap = null;
    }
  }

  return Response.json({
    name: data.name,
    type: data.types[0].type.name,
    ...(bitmap ? { bitmap } : {}),
  });
}
