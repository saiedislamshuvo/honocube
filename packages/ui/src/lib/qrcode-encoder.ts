/**
 * Standalone QR Code Matrix Generator.
 * Implements ISO/IEC 18004 for Versions 1 through 10.
 * Zero external dependencies.
 */

export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

// Galois Field GF(256) tables for primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let gfVal = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = gfVal;
  GF_EXP[i + 255] = gfVal;
  GF_LOG[gfVal] = i;
  gfVal = (gfVal << 1) ^ (gfVal >= 128 ? 0x11d : 0);
}

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  const logX = GF_LOG[x] ?? 0;
  const logY = GF_LOG[y] ?? 0;
  return GF_EXP[logX + logY] ?? 0;
}

// Reed-Solomon generator polynomial and division
function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  let g: number[] = [1];
  for (let i = 0; i < ecCount; i++) {
    const next: number[] = new Array<number>(g.length + 1).fill(0);
    const root = GF_EXP[i] ?? 0;
    for (let j = 0; j < g.length; j++) {
      const gVal = g[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ gfMul(gVal, root);
      next[j + 1] = (next[j + 1] ?? 0) ^ gVal;
    }
    g = next;
  }

  const remainder: number[] = new Array<number>(ecCount).fill(0);
  for (const b of data) {
    const factor = b ^ (remainder[0] ?? 0);
    for (let j = 0; j < ecCount - 1; j++) {
      const gCoeff = g[ecCount - 1 - j] ?? 0;
      remainder[j] = (remainder[j + 1] ?? 0) ^ gfMul(gCoeff, factor);
    }
    const g0 = g[0] ?? 0;
    remainder[ecCount - 1] = gfMul(g0, factor);
  }
  return new Uint8Array(remainder);
}

interface VersionSpec {
  totalDataCodewords: number;
  ecPerBlock: number;
  blocksG1: number;
  dataG1: number;
  blocksG2: number;
  dataG2: number;
}

const SPEC_TABLE: Record<number, Record<QrErrorCorrectionLevel, VersionSpec>> = {
  1: {
    L: { totalDataCodewords: 19, ecPerBlock: 7, blocksG1: 1, dataG1: 19, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 16, ecPerBlock: 10, blocksG1: 1, dataG1: 16, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 13, ecPerBlock: 13, blocksG1: 1, dataG1: 13, blocksG2: 0, dataG2: 0 },
    H: { totalDataCodewords: 9, ecPerBlock: 17, blocksG1: 1, dataG1: 9, blocksG2: 0, dataG2: 0 }
  },
  2: {
    L: { totalDataCodewords: 34, ecPerBlock: 10, blocksG1: 1, dataG1: 34, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 28, ecPerBlock: 16, blocksG1: 1, dataG1: 28, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 22, ecPerBlock: 22, blocksG1: 1, dataG1: 22, blocksG2: 0, dataG2: 0 },
    H: { totalDataCodewords: 16, ecPerBlock: 28, blocksG1: 1, dataG1: 16, blocksG2: 0, dataG2: 0 }
  },
  3: {
    L: { totalDataCodewords: 55, ecPerBlock: 15, blocksG1: 1, dataG1: 55, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 44, ecPerBlock: 26, blocksG1: 1, dataG1: 44, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 34, ecPerBlock: 18, blocksG1: 2, dataG1: 17, blocksG2: 0, dataG2: 0 },
    H: { totalDataCodewords: 26, ecPerBlock: 22, blocksG1: 2, dataG1: 13, blocksG2: 0, dataG2: 0 }
  },
  4: {
    L: { totalDataCodewords: 80, ecPerBlock: 20, blocksG1: 1, dataG1: 80, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 64, ecPerBlock: 18, blocksG1: 2, dataG1: 32, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 48, ecPerBlock: 26, blocksG1: 2, dataG1: 24, blocksG2: 0, dataG2: 0 },
    H: { totalDataCodewords: 36, ecPerBlock: 16, blocksG1: 4, dataG1: 9, blocksG2: 0, dataG2: 0 }
  },
  5: {
    L: { totalDataCodewords: 108, ecPerBlock: 26, blocksG1: 1, dataG1: 108, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 86, ecPerBlock: 24, blocksG1: 2, dataG1: 43, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 62, ecPerBlock: 18, blocksG1: 2, dataG1: 15, blocksG2: 2, dataG2: 16 },
    H: { totalDataCodewords: 46, ecPerBlock: 22, blocksG1: 2, dataG1: 11, blocksG2: 2, dataG2: 12 }
  },
  6: {
    L: { totalDataCodewords: 136, ecPerBlock: 18, blocksG1: 2, dataG1: 68, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 108, ecPerBlock: 16, blocksG1: 4, dataG1: 27, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 76, ecPerBlock: 24, blocksG1: 4, dataG1: 19, blocksG2: 0, dataG2: 0 },
    H: { totalDataCodewords: 60, ecPerBlock: 28, blocksG1: 4, dataG1: 15, blocksG2: 0, dataG2: 0 }
  },
  7: {
    L: { totalDataCodewords: 156, ecPerBlock: 20, blocksG1: 2, dataG1: 78, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 124, ecPerBlock: 18, blocksG1: 4, dataG1: 31, blocksG2: 0, dataG2: 0 },
    Q: { totalDataCodewords: 88, ecPerBlock: 18, blocksG1: 2, dataG1: 14, blocksG2: 4, dataG2: 15 },
    H: { totalDataCodewords: 66, ecPerBlock: 26, blocksG1: 4, dataG1: 13, blocksG2: 1, dataG2: 14 }
  },
  8: {
    L: { totalDataCodewords: 194, ecPerBlock: 24, blocksG1: 2, dataG1: 97, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 154, ecPerBlock: 22, blocksG1: 2, dataG1: 38, blocksG2: 2, dataG2: 39 },
    Q: { totalDataCodewords: 110, ecPerBlock: 22, blocksG1: 4, dataG1: 18, blocksG2: 2, dataG2: 19 },
    H: { totalDataCodewords: 86, ecPerBlock: 26, blocksG1: 4, dataG1: 14, blocksG2: 2, dataG2: 15 }
  },
  9: {
    L: { totalDataCodewords: 232, ecPerBlock: 30, blocksG1: 2, dataG1: 116, blocksG2: 0, dataG2: 0 },
    M: { totalDataCodewords: 182, ecPerBlock: 22, blocksG1: 3, dataG1: 36, blocksG2: 2, dataG2: 37 },
    Q: { totalDataCodewords: 132, ecPerBlock: 20, blocksG1: 4, dataG1: 16, blocksG2: 4, dataG2: 17 },
    H: { totalDataCodewords: 100, ecPerBlock: 24, blocksG1: 4, dataG1: 12, blocksG2: 4, dataG2: 13 }
  },
  10: {
    L: { totalDataCodewords: 274, ecPerBlock: 18, blocksG1: 2, dataG1: 68, blocksG2: 2, dataG2: 69 },
    M: { totalDataCodewords: 216, ecPerBlock: 26, blocksG1: 4, dataG1: 43, blocksG2: 1, dataG2: 44 },
    Q: { totalDataCodewords: 154, ecPerBlock: 24, blocksG1: 6, dataG1: 19, blocksG2: 2, dataG2: 20 },
    H: { totalDataCodewords: 122, ecPerBlock: 28, blocksG1: 6, dataG1: 15, blocksG2: 2, dataG2: 16 }
  }
};

const ALIGNMENT_PATTERN_LOCATIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50]
};

const FORMAT_INFO: Record<QrErrorCorrectionLevel, number[]> = {
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed]
};

function encodeUtf8(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      bytes.push(charcode);
    } else if (charcode < 0x800) {
      bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }
  return bytes;
}

function createDataCodewords(text: string, version: number, level: QrErrorCorrectionLevel): Uint8Array {
  const spec = SPEC_TABLE[version]?.[level] || SPEC_TABLE[1]!.M;
  const utf8 = encodeUtf8(text);

  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // 1. Mode indicator: 0100 (Byte mode)
  pushBits(0b0100, 4);

  // 2. Character count indicator
  const charCountBits = version < 10 ? 8 : 16;
  pushBits(utf8.length, charCountBits);

  // 3. Data bytes
  for (const b of utf8) {
    pushBits(b, 8);
  }

  // 4. Terminator
  const maxDataBits = spec.totalDataCodewords * 8;
  const termLen = Math.min(4, maxDataBits - bits.length);
  pushBits(0, termLen);

  // 5. Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 6. Convert to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (bits[i + j] ?? 0);
    }
    dataBytes.push(b);
  }

  // 7. Pad with alternating 0xEC and 0x11
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < spec.totalDataCodewords) {
    dataBytes.push(padPatterns[padIdx % 2] ?? 0xec);
    padIdx++;
  }

  // 8. Split into blocks and compute Reed-Solomon EC codewords
  const totalBlocks = spec.blocksG1 + spec.blocksG2;
  const blocksData: Uint8Array[] = [];
  const blocksEc: Uint8Array[] = [];

  let offset = 0;
  for (let b = 0; b < spec.blocksG1; b++) {
    const chunk = new Uint8Array(dataBytes.slice(offset, offset + spec.dataG1));
    blocksData.push(chunk);
    blocksEc.push(rsComputeRemainder(chunk, spec.ecPerBlock));
    offset += spec.dataG1;
  }
  for (let b = 0; b < spec.blocksG2; b++) {
    const chunk = new Uint8Array(dataBytes.slice(offset, offset + spec.dataG2));
    blocksData.push(chunk);
    blocksEc.push(rsComputeRemainder(chunk, spec.ecPerBlock));
    offset += spec.dataG2;
  }

  // 9. Interleave data codewords
  const interleaved: number[] = [];
  const maxDataLen = Math.max(spec.dataG1, spec.dataG2);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      const block = blocksData[b];
      if (block && i < block.length) {
        interleaved.push(block[i] ?? 0);
      }
    }
  }

  // 10. Interleave EC codewords
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      const ecBlock = blocksEc[b];
      if (ecBlock && i < ecBlock.length) {
        interleaved.push(ecBlock[i] ?? 0);
      }
    }
  }

  return new Uint8Array(interleaved);
}

function findBestVersion(text: string, level: QrErrorCorrectionLevel): number {
  const utf8Len = encodeUtf8(text).length;
  for (let v = 1; v <= 10; v++) {
    const spec = SPEC_TABLE[v]?.[level];
    if (!spec) continue;
    const headerBits = 4 + (v < 10 ? 8 : 16);
    const capacityBytes = Math.floor((spec.totalDataCodewords * 8 - headerBits) / 8);
    if (utf8Len <= capacityBytes) {
      return v;
    }
  }
  return 10;
}

/**
 * Builds the complete QR code module matrix for the given text.
 */
export function encodeQRCode(text: string, level: QrErrorCorrectionLevel = "M"): QrMatrix {
  const version = findBestVersion(text, level);
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  function setFunctionModule(r: number, c: number, val: boolean) {
    const modRow = modules[r];
    const funcRow = isFunction[r];
    if (modRow && funcRow) {
      modRow[c] = val;
      funcRow[c] = true;
    }
  }

  // 1. Finder patterns (7x7) + separators
  function drawFinderPattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setFunctionModule(nr, nc, isBlack);
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // 2. Alignment patterns for version >= 2
  const alignCoords = ALIGNMENT_PATTERN_LOCATIONS[version] || [];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      const funcRow = isFunction[r];
      if (funcRow && funcRow[c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(r + dr, c + dc, isBlack);
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const r6 = isFunction[6];
    const ci = isFunction[i];
    if (r6 && !r6[i]) setFunctionModule(6, i, i % 2 === 0);
    if (ci && !ci[6]) setFunctionModule(i, 6, i % 2 === 0);
  }

  // 4. Dark module
  setFunctionModule(4 * version + 9, 8, true);

  // 5. Reserve format information areas
  for (let i = 0; i <= 8; i++) {
    const f8 = isFunction[8];
    const fi = isFunction[i];
    if (f8 && !f8[i]) f8[i] = true;
    if (fi && !fi[8]) fi[8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    const f8 = isFunction[8];
    if (f8 && !f8[i]) f8[i] = true;
  }
  for (let i = size - 7; i < size; i++) {
    const fi = isFunction[i];
    if (fi && !fi[8]) fi[8] = true;
  }

  // 6. Place data codewords
  const data = createDataCodewords(text, version, level);
  const dataBits: number[] = [];
  for (const b of data) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((b >>> i) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const rows = upwards ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const r of rows) {
      for (let c = right; c >= right - 1; c--) {
        const funcRow = isFunction[r];
        const modRow = modules[r];
        if (funcRow && modRow && !funcRow[c]) {
          const bit = bitIdx < dataBits.length ? (dataBits[bitIdx] ?? 0) : 0;
          modRow[c] = bit === 1;
          bitIdx++;
        }
      }
    }
    upwards = !upwards;
  }

  // 7. Apply Mask Pattern 0: (row + col) % 2 === 0
  for (let r = 0; r < size; r++) {
    const funcRow = isFunction[r];
    const modRow = modules[r];
    if (funcRow && modRow) {
      for (let c = 0; c < size; c++) {
        if (!funcRow[c]) {
          if ((r + c) % 2 === 0) {
            modRow[c] = !modRow[c];
          }
        }
      }
    }
  }

  // 8. Write format bits (Mask 0)
  const formatList = FORMAT_INFO[level] || FORMAT_INFO.M;
  const formatBits = formatList[0] ?? 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> (14 - i)) & 1) === 1;
    if (i <= 5) setFunctionModule(8, i, bit);
    else if (i === 6) setFunctionModule(8, 7, bit);
    else if (i === 7) setFunctionModule(8, 8, bit);
    else if (i === 8) setFunctionModule(7, 8, bit);
    else setFunctionModule(14 - i, 8, bit);

    if (i < 8) {
      setFunctionModule(size - 1 - i, 8, bit);
    } else {
      setFunctionModule(8, size - 15 + i, bit);
    }
  }

  return { size, modules };
}
