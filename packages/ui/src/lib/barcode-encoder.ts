/**
 * Lightweight SVG Barcode Generator for Code128, Code39, EAN-13, and UPC-A.
 * Zero external dependencies.
 */

export type BarcodeFormat = "code128" | "code39" | "ean13" | "upca";

export interface EncodedBarcode {
  modules: boolean[];
  text: string;
}

// Code 128 patterns (0-106). Each string defines widths of alternating bars and spaces.
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

function patternToModules(pattern: string): boolean[] {
  const result: boolean[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const width = char ? parseInt(char, 10) : 1;
    const isBar = i % 2 === 0;
    for (let w = 0; w < width; w++) {
      result.push(isBar);
    }
  }
  return result;
}

function encodeCode128(text: string): EncodedBarcode {
  const codes: number[] = [104]; // Start B
  let checksum = 104;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const code = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop pattern

  const modules: boolean[] = [];
  for (const c of codes) {
    const pat = CODE128_PATTERNS[c] || CODE128_PATTERNS[0]!;
    modules.push(...patternToModules(pat));
  }

  return { modules, text };
}

// Code 39 character table: 9 elements (5 bars, 4 spaces), 1 = narrow, 2 = wide
const CODE39_ENCODINGS: Record<string, string> = {
  "0": "111221211", "1": "211211112", "2": "112211112", "3": "212211111", "4": "111221112",
  "5": "211221111", "6": "112221111", "7": "111211212", "8": "211211211", "9": "112211211",
  "A": "211112112", "B": "112112112", "C": "212112111", "D": "111122112", "E": "211122111",
  "F": "112122111", "G": "111112212", "H": "211112211", "I": "112112211", "J": "111122211",
  "K": "211111122", "L": "112111122", "M": "212111121", "N": "111121122", "O": "211121121",
  "P": "112121121", "Q": "111111222", "R": "211111221", "S": "112111221", "T": "111121221",
  "U": "221111112", "V": "122111112", "W": "222111111", "X": "121121112", "Y": "221121111",
  "Z": "122121111", "-": "121111212", ".": "221111211", " ": "122111211", "*": "121121211",
  "$": "121212111", "/": "121211121", "+": "121112121", "%": "111212121"
};

function encodeCode39(rawText: string): EncodedBarcode {
  const upper = rawText.toUpperCase();
  const text = `*${upper.replace(/[^0-9A-Z\-. $/+%]/g, "")}*`;
  const modules: boolean[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const pattern = (char ? CODE39_ENCODINGS[char] : undefined) || CODE39_ENCODINGS[" "]!;
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const width = pattern[j] === "2" ? 2 : 1;
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
    }
    if (i < text.length - 1) {
      modules.push(false);
    }
  }

  return { modules, text: upper };
}

// EAN-13 Digit patterns (7 modules each)
const EAN_L: string[] = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];
const EAN_G: string[] = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];
const EAN_R: string[] = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100"
];

// First digit parity structure for left 6 digits (0 = L, 1 = G)
const EAN_PARITY: string[] = [
  "000000", "001011", "001101", "001110", "010011",
  "011001", "011100", "010101", "010110", "011010"
];

function computeEan13Checksum(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const ch = digits12[i];
    const d = ch ? parseInt(ch, 10) : 0;
    sum += i % 2 === 0 ? d : d * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

function encodeEan13(rawDigits: string): EncodedBarcode {
  let digits = rawDigits.replace(/\D/g, "");
  if (digits.length < 12) {
    digits = digits.padEnd(12, "0");
  } else if (digits.length > 13) {
    digits = digits.slice(0, 13);
  }

  if (digits.length === 12) {
    digits += computeEan13Checksum(digits);
  }

  const firstChar = digits[0];
  const firstDigit = firstChar ? parseInt(firstChar, 10) : 0;
  const parity = EAN_PARITY[firstDigit] || "000000";
  const modules: boolean[] = [];

  // Start guard 101
  modules.push(true, false, true);

  // Left 6 digits (digits 1 to 6)
  for (let i = 1; i <= 6; i++) {
    const ch = digits[i];
    const d = ch ? parseInt(ch, 10) : 0;
    const useG = parity[i - 1] === "1";
    const pattern = (useG ? EAN_G[d] : EAN_L[d]) || "0001101";
    for (const bit of pattern) {
      modules.push(bit === "1");
    }
  }

  // Center guard 01010
  modules.push(false, true, false, true, false);

  // Right 6 digits (digits 7 to 12)
  for (let i = 7; i <= 12; i++) {
    const ch = digits[i];
    const d = ch ? parseInt(ch, 10) : 0;
    const pattern = EAN_R[d] || "1110010";
    for (const bit of pattern) {
      modules.push(bit === "1");
    }
  }

  // End guard 101
  modules.push(true, false, true);

  return { modules, text: digits };
}

function encodeUpcA(rawDigits: string): EncodedBarcode {
  let digits = rawDigits.replace(/\D/g, "");
  if (digits.length < 11) {
    digits = digits.padEnd(11, "0");
  }
  if (digits.length === 11) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const ch = digits[i];
      const d = ch ? parseInt(ch, 10) : 0;
      sum += i % 2 === 0 ? d * 3 : d;
    }
    const mod = sum % 10;
    digits += mod === 0 ? "0" : (10 - mod).toString();
  }
  const ean13 = encodeEan13("0" + digits.slice(0, 12));
  return { modules: ean13.modules, text: digits.slice(0, 12) };
}

/**
 * Encodes a text value into barcode modules for rendering.
 */
export function encodeBarcode(value: string, format: BarcodeFormat = "code128"): EncodedBarcode {
  const safeVal = (value ?? "").toString().trim() || "0";
  switch (format) {
    case "code39":
      return encodeCode39(safeVal);
    case "ean13":
      return encodeEan13(safeVal);
    case "upca":
      return encodeUpcA(safeVal);
    case "code128":
    default:
      return encodeCode128(safeVal);
  }
}
