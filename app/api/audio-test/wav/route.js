// Minimal generated WAV endpoint for testing raw DAC playback on the ESP32
// (PokeDesk). Produces an uncompressed 8-bit unsigned PCM mono WAV at
// 16000 Hz — the exact format the ESP32 DAC (dacWrite) can play sample by
// sample with no decoding, unlike the MP3 endpoint at /api/audio-test.
export const runtime = "nodejs";

const SAMPLE_RATE = 16000;
const DURATION_SECONDS = 0.6;
const TONE_HZ = 440;
const NUM_SAMPLES = Math.round(SAMPLE_RATE * DURATION_SECONDS);
const FADE_SAMPLES = Math.round(SAMPLE_RATE * 0.01); // 10ms fade to avoid clicks

function buildWavHeader(dataLength) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  header.writeUInt16LE(1, 20); // audio format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE, 28); // byte rate (sampleRate * channels * bytesPerSample)
  header.writeUInt16LE(1, 32); // block align (channels * bytesPerSample)
  header.writeUInt16LE(8, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function buildTone() {
  const data = Buffer.alloc(NUM_SAMPLES);
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let envelope = 1;
    if (i < FADE_SAMPLES) envelope = i / FADE_SAMPLES;
    else if (i > NUM_SAMPLES - FADE_SAMPLES) envelope = (NUM_SAMPLES - i) / FADE_SAMPLES;

    const sample = Math.sin(2 * Math.PI * TONE_HZ * t) * envelope;
    data[i] = Math.round((sample * 0.5 + 0.5) * 255); // unsigned 8-bit, centered at 128
  }
  return data;
}

export async function GET() {
  const data = buildTone();
  const wav = Buffer.concat([buildWavHeader(data.length), data]);

  return new Response(wav, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": wav.length.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
