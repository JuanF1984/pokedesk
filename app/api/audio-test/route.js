// Minimal static audio endpoint for testing MP3 playback on the ESP32
// (PokeDesk). Serves a pre-generated, short beep-pattern MP3 as-is — no
// per-request encoding, no image-style processing.
export const runtime = "nodejs";

import fs from "fs";
import path from "path";

const MP3_PATH = path.join(process.cwd(), "assets", "audio", "pokedesk-test.mp3");

export async function GET() {
  const mp3 = fs.readFileSync(MP3_PATH);

  return new Response(mp3, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": mp3.length.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
