// Converts a Pokémon sprite (RGBA, transparent background) into a 1-bit
// monochrome bitmap suitable for Adafruit_GFX::drawBitmap() on a small OLED
// (e.g. SSD1306 128x64), while staying readable for both very dark and very
// light sprites.
//
// Design summary (see project chat / commit message for the full rationale):
// - The alpha channel is treated as a hard mask: transparent pixels are
//   ALWAYS off, and they are excluded from every brightness calculation so a
//   dark sprite is never statistically "merged" with the background.
// - Several independent strategies produce a candidate 0/1 mask each. A
//   scoring heuristic then picks the most readable candidate per sprite,
//   because no single technique wins for every sprite (dark vs light vs
//   low-contrast vs highly detailed).

// ---------------------------------------------------------------------------
// Tunable parameters (grouped here so they're easy to find and adjust).
// ---------------------------------------------------------------------------
export const TUNABLES = {
  // A pixel counts as "part of the sprite" once its alpha is above this.
  // Lower = keep more soft/antialiased edge pixels; higher = stricter silhouette.
  ALPHA_MASK_THRESHOLD: 32,

  // Fallback fixed threshold strategy (kept as a baseline candidate only).
  FIXED_THRESHOLD: 128,

  // Otsu-with-contour: how much darker than the Otsu threshold a pixel needs
  // to be for the *contour ring* override to still not be enough on its own.
  // (Kept simple: the contour ring is OR'd in regardless of brightness.)
  CONTOUR_RING_WIDTH: 1, // pixels of erosion/dilation used to build the ring

  // Scoring weights - raise a weight to make that criterion matter more when
  // picking the winning strategy. See scoreMask() for how each is used.
  SCORE_WEIGHTS: {
    onRatio: 40, // reward on% (within the sprite area) close to TARGET_ON_RATIO
    contourCoverage: 25, // reward keeping the outer silhouette outline visible
    largestComponentRatio: 15, // reward one coherent shape vs. scattered noise
    detail: 10, // reward some internal light/dark transitions (not zero, not noise)
    componentPenalty: 20, // subtract for excess disconnected blobs (speckle/noise)
  },
  TARGET_ON_RATIO: 0.5, // "ideal" fraction of the sprite area left ON
  ON_RATIO_TOLERANCE: 0.35, // how forgiving the onRatio score is around the target
  MAX_EXPECTED_COMPONENTS: 6, // components above this count start being penalized
};

// ---------------------------------------------------------------------------
// sharp loading (kept lazy/defensive, matching the route's existing pattern)
// ---------------------------------------------------------------------------
export async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch (err) {
    console.error("[spriteBitmap] sharp failed to load:", err?.message ?? err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Decoding: sprite buffer -> { gray, alphaMask, width, height }
// ---------------------------------------------------------------------------

// Resizes with a transparent (not black-flattened) background and returns
// grayscale luminance + a boolean opacity mask, both Uint8Arrays of length
// width*height. Using `kernel: "nearest"` avoids blurring pixel-art edges,
// which keeps the alpha mask crisp instead of full of half-transparent halo
// pixels.
export async function decodeSprite(sharp, spriteBuffer, width, height) {
  const { data, info } = await sharp(spriteBuffer)
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.nearest,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  const gray = new Uint8Array(w * h);
  const alphaMask = new Uint8Array(w * h);

  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // Standard luma (BT.601), computed only from RGB - alpha is handled
    // completely separately so it never pollutes the brightness histogram.
    gray[p] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    alphaMask[p] = a >= TUNABLES.ALPHA_MASK_THRESHOLD ? 1 : 0;
  }

  return { gray, alphaMask, width: w, height: h };
}

// ---------------------------------------------------------------------------
// Otsu's method, computed only over opaque (alphaMask=1) pixels.
// ---------------------------------------------------------------------------
export function computeOtsuThreshold(gray, alphaMask) {
  const hist = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < gray.length; i++) {
    if (alphaMask[i]) {
      hist[gray[i]]++;
      total++;
    }
  }
  if (total === 0) return TUNABLES.FIXED_THRESHOLD;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    weightB += hist[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * hist[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (between > maxVariance) {
      maxVariance = between;
      threshold = t;
    }
  }
  return threshold;
}

// ---------------------------------------------------------------------------
// Morphology helpers on a 0/1 mask (4-connected), used to build a "contour
// ring" (dilate minus erode) that represents the sprite's outer outline.
// ---------------------------------------------------------------------------
function erode(mask, width, height) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const up = y > 0 ? mask[i - width] : 0;
      const down = y < height - 1 ? mask[i + width] : 0;
      const left = x > 0 ? mask[i - 1] : 0;
      const right = x < width - 1 ? mask[i + 1] : 0;
      out[i] = up && down && left && right ? 1 : 0;
    }
  }
  return out;
}

// Inner boundary strip only (alphaMask minus its erosion) - deliberately NOT
// dilated outward, because pixels outside alphaMask are transparent and must
// stay off no matter what, so a ring that reaches outside alphaMask could
// never be fully honored and would just make contour-coverage scoring noisy.
function contourRing(alphaMask, width, height) {
  let inner = alphaMask;
  for (let i = 0; i < TUNABLES.CONTOUR_RING_WIDTH; i++) {
    inner = erode(inner, width, height);
  }
  const ring = new Uint8Array(alphaMask.length);
  for (let i = 0; i < ring.length; i++) {
    ring[i] = alphaMask[i] && !inner[i] ? 1 : 0;
  }
  return ring;
}

// ---------------------------------------------------------------------------
// Strategies. Each returns a Uint8Array mask (0/1) of length width*height.
// Every strategy forces transparent pixels to 0 - that invariant is what
// guarantees "no artificial background rectangles" regardless of technique.
// ---------------------------------------------------------------------------

export function strategyFixedThreshold(gray, alphaMask) {
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    mask[i] = alphaMask[i] && gray[i] > TUNABLES.FIXED_THRESHOLD ? 1 : 0;
  }
  return mask;
}

export function strategyOtsu(gray, alphaMask) {
  const threshold = computeOtsuThreshold(gray, alphaMask);
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    mask[i] = alphaMask[i] && gray[i] > threshold ? 1 : 0;
  }
  return mask;
}

// Otsu's per-sprite threshold, but the outer silhouette ring is OR'd in so a
// dark sprite (whose whole body can legitimately fall on the "dark" side of
// its own Otsu split) never loses its recognizable outline.
export function strategyOtsuWithContour(gray, alphaMask, width, height) {
  const threshold = computeOtsuThreshold(gray, alphaMask);
  const ring = contourRing(alphaMask, width, height);
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    if (!alphaMask[i]) continue;
    mask[i] = gray[i] > threshold || ring[i] ? 1 : 0;
  }
  return mask;
}

// Shared error-diffusion dithering core. `kernel` is a list of
// [dx, dy, weight] describing how much error propagates to each neighbor;
// weights should sum to <= 1.
function ditherWithKernel(gray, alphaMask, width, height, kernel) {
  const work = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) work[i] = gray[i];

  const mask = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!alphaMask[i]) continue;

      const oldValue = work[i];
      const on = oldValue >= 128;
      mask[i] = on ? 1 : 0;
      const error = oldValue - (on ? 255 : 0);

      for (const [dx, dy, weight] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (!alphaMask[ni]) continue; // don't leak error into the background
        work[ni] += error * weight;
      }
    }
  }
  return mask;
}

const FLOYD_STEINBERG_KERNEL = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

export function strategyFloydSteinberg(gray, alphaMask, width, height) {
  return ditherWithKernel(gray, alphaMask, width, height, FLOYD_STEINBERG_KERNEL);
}

// Atkinson only propagates 6/8 of the error (discarding 2/8), which produces
// higher local contrast and less "smearing" than Floyd-Steinberg. It was
// designed for exactly this kind of small, high-contrast monochrome display.
const ATKINSON_KERNEL = [
  [1, 0, 1 / 8],
  [2, 0, 1 / 8],
  [-1, 1, 1 / 8],
  [0, 1, 1 / 8],
  [1, 1, 1 / 8],
  [0, 2, 1 / 8],
];

export function strategyAtkinson(gray, alphaMask, width, height) {
  return ditherWithKernel(gray, alphaMask, width, height, ATKINSON_KERNEL);
}

// ---------------------------------------------------------------------------
// Scoring: picks the most readable candidate mask without hardcoding "dark
// sprites use strategy X". See TUNABLES.SCORE_WEIGHTS to rebalance.
// ---------------------------------------------------------------------------

// 4-connected component sizes, returned as an array (one entry per blob).
function connectedComponentSizes(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const sizes = [];
  const stack = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let size = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % width;
      const y = (i - x) / width;
      const neighbors = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && mask[n] && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  return sizes;
}

// Fraction of the alpha silhouette's contour ring that ended up ON. Low
// values mean the outer outline got eaten (the classic "dark sprite
// disappeared" failure mode).
function contourCoverageOf(mask, ring) {
  let ringCount = 0;
  let onCount = 0;
  for (let i = 0; i < ring.length; i++) {
    if (ring[i]) {
      ringCount++;
      if (mask[i]) onCount++;
    }
  }
  return ringCount === 0 ? 0 : onCount / ringCount;
}

// Counts horizontal+vertical ON/OFF transitions inside the sprite area, as a
// cheap proxy for "there is some internal detail/edges", normalized to
// [0, 1] via a soft cap so heavy dithering noise doesn't just win by having
// the most transitions.
function detailScoreOf(mask, alphaMask, width, height) {
  let transitions = 0;
  let interior = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!alphaMask[i]) continue;
      interior++;
      if (x < width - 1 && alphaMask[i + 1] && mask[i] !== mask[i + 1]) transitions++;
      if (y < height - 1 && alphaMask[i + width] && mask[i] !== mask[i + width]) transitions++;
    }
  }
  if (interior === 0) return 0;
  const rate = transitions / interior;
  // A "reasonable amount of detail" tops out around rate ~0.35 for pixel-art
  // sprites; beyond that it reads as noise rather than detail, so the score
  // saturates instead of continuing to reward it.
  return Math.min(rate / 0.35, 1);
}

export function scoreMask(mask, alphaMask, ring, width, height) {
  const weights = TUNABLES.SCORE_WEIGHTS;

  let spriteArea = 0;
  let onCount = 0;
  for (let i = 0; i < mask.length; i++) {
    if (alphaMask[i]) {
      spriteArea++;
      if (mask[i]) onCount++;
    }
  }

  if (spriteArea === 0) return { score: 0, onCount, spriteArea };

  const onRatio = onCount / spriteArea;

  // Empty or fully-saturated results are the two failure modes the user
  // explicitly called out - score them near zero regardless of everything
  // else instead of letting other terms compensate.
  if (onRatio < 0.02 || onRatio > 0.98) {
    return { score: 0.001, onCount, spriteArea, onRatio };
  }

  const onRatioScore = Math.max(
    0,
    1 - Math.abs(onRatio - TUNABLES.TARGET_ON_RATIO) / TUNABLES.ON_RATIO_TOLERANCE
  );

  const contourCoverage = contourCoverageOf(mask, ring);

  const sizes = connectedComponentSizes(mask, width, height);
  const largestComponentRatio = sizes.length ? Math.max(...sizes) / onCount : 0;
  const componentPenalty =
    Math.max(0, sizes.length - TUNABLES.MAX_EXPECTED_COMPONENTS) /
    Math.max(1, TUNABLES.MAX_EXPECTED_COMPONENTS);

  const detail = detailScoreOf(mask, alphaMask, width, height);

  const score =
    weights.onRatio * onRatioScore +
    weights.contourCoverage * contourCoverage +
    weights.largestComponentRatio * largestComponentRatio +
    weights.detail * detail -
    weights.componentPenalty * Math.min(componentPenalty, 1);

  return {
    score,
    onCount,
    spriteArea,
    onRatio,
    contourCoverage,
    largestComponentRatio,
    componentCount: sizes.length,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Runs every strategy, scores each, and returns the winner (plus, optionally,
// every candidate's mask+score for debugging/preview purposes).
// ---------------------------------------------------------------------------
export function selectBestMask(gray, alphaMask, width, height, { includeAll = false } = {}) {
  const ring = contourRing(alphaMask, width, height);

  const candidates = [
    { name: "fixed-threshold", mask: strategyFixedThreshold(gray, alphaMask) },
    { name: "otsu", mask: strategyOtsu(gray, alphaMask) },
    { name: "otsu-contour", mask: strategyOtsuWithContour(gray, alphaMask, width, height) },
    { name: "floyd-steinberg", mask: strategyFloydSteinberg(gray, alphaMask, width, height) },
    { name: "atkinson", mask: strategyAtkinson(gray, alphaMask, width, height) },
  ];

  for (const c of candidates) {
    c.stats = scoreMask(c.mask, alphaMask, ring, width, height);
  }

  candidates.sort((a, b) => b.stats.score - a.stats.score);
  const winner = candidates[0];

  return {
    winner,
    all: includeAll ? candidates : undefined,
  };
}

// ---------------------------------------------------------------------------
// Packs a 0/1 mask into the 1bpp, MSB-first, row-padded-to-byte layout that
// Adafruit_GFX::drawBitmap() expects.
// ---------------------------------------------------------------------------
export function packMonochromeBitmap(mask, width, height) {
  const rowBytes = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        const byteIndex = y * rowBytes + (x >> 3);
        bitmap[byteIndex] |= 1 << (7 - (x % 8));
      }
    }
  }

  return bitmap;
}

// ---------------------------------------------------------------------------
// High-level entry point used by the API route.
// ---------------------------------------------------------------------------
export async function buildBitmapFromSprite(spriteBuffer, width, height, { debug = false } = {}) {
  const sharp = await loadSharp();
  if (!sharp) return null;

  const { gray, alphaMask, width: w, height: h } = await decodeSprite(
    sharp,
    spriteBuffer,
    width,
    height
  );

  const { winner, all } = selectBestMask(gray, alphaMask, w, h, { includeAll: debug });

  const packed = packMonochromeBitmap(winner.mask, w, h);

  const result = {
    width: w,
    height: h,
    format: "adafruit_gfx_1bpp",
    encoding: "base64",
    data: packed.toString("base64"),
  };

  if (debug) {
    result.debug = {
      strategy: winner.name,
      stats: winner.stats,
      candidates: all.map((c) => ({ name: c.name, stats: c.stats })),
    };
  }

  return result;
}
