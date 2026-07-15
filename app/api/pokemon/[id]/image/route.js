// Serves the official artwork as a small flattened JPEG for devices (ESP32 +
// TFT) that would rather not decode a large PNG-with-alpha themselves. Sharp
// is loaded lazily/defensively via lib/spriteBitmap.js, matching the sibling
// bitmap route's pattern.
export const runtime = "nodejs";

import { loadSharp } from "@/lib/spriteBitmap";

const SIZE = 160;
const JPEG_QUALITY = 82;

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing pokemon id" }, { status: 400 });
  }

  let response;
  try {
    response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  } catch {
    return Response.json({ error: "Network error" }, { status: 502 });
  }

  if (response.status === 404) {
    return Response.json({ error: "Pokemon not found" }, { status: 404 });
  }

  if (!response.ok) {
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }

  const data = await response.json();
  const artworkUrl = data.sprites?.other?.["official-artwork"]?.front_default;

  if (!artworkUrl) {
    return Response.json({ error: "No artwork available" }, { status: 404 });
  }

  let artworkRes;
  try {
    artworkRes = await fetch(artworkUrl);
  } catch (err) {
    console.error("[pokemon/image] artwork fetch failed:", err?.message ?? err);
    return Response.json({ error: "Network error" }, { status: 502 });
  }

  if (!artworkRes.ok) {
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }

  const sharp = await loadSharp();
  if (!sharp) {
    return Response.json({ error: "Image processing unavailable" }, { status: 500 });
  }

  let jpeg;
  try {
    const artworkBuffer = Buffer.from(await artworkRes.arrayBuffer());
    jpeg = await sharp(artworkBuffer)
      .resize(SIZE, SIZE, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch (err) {
    console.error("[pokemon/image] processing failed:", err?.message ?? err);
    return Response.json({ error: "Image processing failed" }, { status: 500 });
  }

  return new Response(jpeg, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": jpeg.length.toString(),
      Connection: "close",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
