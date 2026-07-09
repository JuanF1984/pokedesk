import sharp from "sharp";

const MIN_SIZE = 8;
const MAX_SIZE = 64;
const DEFAULT_SIZE = 48;
const THRESHOLD = 128;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Packs 8-bit grayscale pixels (0 or 255 after threshold) into the 1bpp,
// MSB-first, row-padded-to-byte layout that Adafruit_GFX::drawBitmap() expects.
function packMonochromeBitmap(pixels, width, height) {
  const rowBytes = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x] > THRESHOLD) {
        const byteIndex = y * rowBytes + (x >> 3);
        bitmap[byteIndex] |= 1 << (7 - (x % 8));
      }
    }
  }

  return bitmap;
}

async function buildBitmap(spriteUrl, width, height) {
  const spriteRes = await fetch(spriteUrl);
  if (!spriteRes.ok) return null;

  const spriteBuffer = Buffer.from(await spriteRes.arrayBuffer());

  const { data: pixels, info } = await sharp(spriteBuffer)
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .grayscale()
    .threshold(THRESHOLD)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const packed = packMonochromeBitmap(pixels, info.width, info.height);

  return {
    width: info.width,
    height: info.height,
    format: "adafruit_gfx_1bpp",
    encoding: "base64",
    data: packed.toString("base64"),
  };
}

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing pokemon id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const width = clamp(parseInt(searchParams.get("w"), 10) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const height = clamp(parseInt(searchParams.get("h"), 10) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);

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
      bitmap = await buildBitmap(spriteUrl, width, height);
    } catch {
      bitmap = null;
    }
  }

  return Response.json({
    name: data.name,
    type: data.types[0].type.name,
    ...(bitmap ? { bitmap } : {}),
  });
}
