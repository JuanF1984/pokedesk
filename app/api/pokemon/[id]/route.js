// Bitmap generation (Sharp) is loaded lazily and defensively inside
// lib/spriteBitmap.js: any failure there (missing platform binary, bad
// sprite data, etc.) must never crash this route or take down the base
// { name, type } response.
export const runtime = "nodejs";

import { buildBitmapFromSprite } from "@/lib/spriteBitmap";

const MIN_SIZE = 8;
const MAX_SIZE = 64;
const DEFAULT_SIZE = 48;

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

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing pokemon id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const width = clamp(parseInt(searchParams.get("w"), 10) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const height = clamp(parseInt(searchParams.get("h"), 10) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  // ?debug=1 attaches the losing candidates' scores alongside the winning
  // strategy, for comparing strategies on a live sprite. Never part of the
  // default response shape.
  const debug = searchParams.get("debug") === "1";

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
