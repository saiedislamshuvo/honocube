export interface SlugifyOptions {
  separator?: string;
  lowercase?: boolean;
}

/**
 * Transforms a human string into a clean, URL-safe alphanumeric slug.
 * E.g., "Summer Linen Shirt & Pants!" -> "summer-linen-shirt-pants"
 */
export function slugify(text?: string | null, options: SlugifyOptions = {}): string {
  if (!text) return "";

  const { separator = "-", lowercase = true } = options;

  let str = String(text).trim();

  if (lowercase) {
    str = str.toLowerCase();
  }

  // Normalize Unicode characters to decompose diacritics / accents (e.g., "é" -> "e")
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Replace any character that is not alphanumeric with the separator
  str = str.replace(/[^a-zA-Z0-9]+/g, separator);

  // Collapse consecutive separators and trim leading/trailing separators
  const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const duplicateRegex = new RegExp(`${escapedSep}+`, "g");
  const trimRegex = new RegExp(`^${escapedSep}+|${escapedSep}+$`, "g");

  str = str.replace(duplicateRegex, separator).replace(trimRegex, "");

  return str;
}
