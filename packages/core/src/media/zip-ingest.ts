export interface ZipArchiveEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number; // 0 = STORE, 8 = DEFLATE
  crc32: number;
  dataOffset: number;
  data?: Uint8Array;
}

export interface IngestedMediaEntry {
  filename: string;
  basename: string;
  extension: string;
  mimeType: string;
  size: number;
  identifier: string;
  variant?: string;
  sequence: number;
  data?: Uint8Array;
  previewUrl?: string;
}

export type IdentifierPattern = "exact" | "prefix_delimiter" | "custom_regex";

export interface IdentifierExtractOptions {
  pattern?: IdentifierPattern;
  delimiter?: string; // default "_" or "-"
  customRegex?: string | RegExp;
  caseSensitive?: boolean;
}

export interface MediaRecordMatch {
  recordId: string | number;
  record: any;
  identifier: string;
  matchedFiles: IngestedMediaEntry[];
  status: "matched" | "already_has_image" | "skipped";
  previewUrl?: string;
}

export interface BulkMediaMatchResult {
  matches: MediaRecordMatch[];
  unmatchedFiles: IngestedMediaEntry[];
  unmatchedRecords: any[];
  totalFiles: number;
  matchedFileCount: number;
  unmatchedFileCount: number;
}

export interface BulkMediaIngestOptions {
  identifierField: string;
  targetField: string;
  strategy?: "replace" | "append" | "skip";
  extractOptions?: IdentifierExtractOptions;
}

/**
 * Standard MIME type detection by file extension.
 */
export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    case "bmp":
      return "image/bmp";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

/**
 * Extracts a record identifier (e.g. SKU, barcode, ID) and optional sequence/variant from a media filename.
 * Example:
 * - "SKU-1001.jpg" -> { identifier: "SKU-1001", sequence: 0 }
 * - "SKU-1001_1.jpg" -> { identifier: "SKU-1001", variant: "1", sequence: 1 }
 * - "SKU-1001_thumb.png" -> { identifier: "SKU-1001", variant: "thumb", sequence: 0 }
 */
export function extractIdentifierFromFilename(
  filename: string,
  options: IdentifierExtractOptions = {}
): { identifier: string; variant?: string; sequence: number } {
  const { pattern = "prefix_delimiter", delimiter = "_", customRegex, caseSensitive = false } = options;

  // Strip path if present
  const baseName = filename.split("/").pop()!.split("\\").pop()!;
  // Remove extension
  const dotIndex = baseName.lastIndexOf(".");
  const nameWithoutExt = dotIndex > 0 ? baseName.substring(0, dotIndex) : baseName;

  if (pattern === "custom_regex" && customRegex) {
    const rx = typeof customRegex === "string" ? new RegExp(customRegex, caseSensitive ? "" : "i") : customRegex;
    const match = rx.exec(nameWithoutExt);
    if (match && match[1]) {
      return {
        identifier: caseSensitive ? match[1] : match[1].trim(),
        variant: match[2],
        sequence: match[2] && !isNaN(Number(match[2])) ? Number(match[2]) : 0,
      };
    }
  }

  if (pattern === "exact") {
    return {
      identifier: caseSensitive ? nameWithoutExt : nameWithoutExt.trim(),
      sequence: 0,
    };
  }

  // "prefix_delimiter" (Default)
  // Splits on specified delimiter (e.g. "_" or "-")
  const delim = delimiter || "_";
  const parts = nameWithoutExt.split(delim);

  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1]!;
    // If last part is numeric (e.g. SKU_1) or a known variant (e.g. SKU_main, SKU_thumb)
    const isNumeric = !isNaN(Number(lastPart));
    const identifier = parts.slice(0, parts.length - 1).join(delim);

    return {
      identifier: caseSensitive ? identifier : identifier.trim(),
      variant: lastPart,
      sequence: isNumeric ? Number(lastPart) : 0,
    };
  }

  return {
    identifier: caseSensitive ? nameWithoutExt : nameWithoutExt.trim(),
    sequence: 0,
  };
}

/**
 * Cross-platform decompressor for raw Deflate (ZIP method 8) byte streams.
 */
export async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const stream = new Blob([compressed as any]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      // fallback
    }
  }

  // Node.js fallback
  try {
    const proc = (globalThis as any).process;
    if (proc && typeof proc.getBuiltinModule === "function") {
      const zlib = proc.getBuiltinModule("zlib");
      return new Uint8Array(zlib.inflateRawSync(compressed));
    }
    const req = (globalThis as any).require;
    if (typeof req === "function") {
      const zlib = req("zlib");
      return new Uint8Array(zlib.inflateRawSync(compressed));
    }
  } catch {
    // fallback
  }

  return compressed;
}

/**
 * Parses and extracts all media files from a ZIP archive Uint8Array.
 * Filters out OS metadata (e.g. __MACOSX, .DS_Store, Thumbs.db) and directories.
 */
export async function extractZipArchive(
  zipBytes: Uint8Array,
  options: IdentifierExtractOptions = {}
): Promise<IngestedMediaEntry[]> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

  // 1. Locate End of Central Directory (EOCD) signature (0x06054b50)
  let eocdOffset = -1;
  const maxSearchLength = Math.min(65557, zipBytes.length);
  for (let i = zipBytes.length - 22; i >= zipBytes.length - maxSearchLength; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP archive: End of Central Directory record not found.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  if (centralDirOffset + centralDirSize > zipBytes.length) {
    throw new Error("Invalid ZIP archive: Central Directory extends beyond file boundaries.");
  }

  const entries: IngestedMediaEntry[] = [];
  let currentOffset = centralDirOffset;
  const decoder = new TextDecoder();

  for (let i = 0; i < totalEntries; i++) {
    if (currentOffset + 46 > zipBytes.length) break;
    const sig = view.getUint32(currentOffset, true);
    if (sig !== 0x02014b50) break;

    const compressionMethod = view.getUint16(currentOffset + 10, true);
    const compressedSize = view.getUint32(currentOffset + 20, true);
    const uncompressedSize = view.getUint32(currentOffset + 24, true);
    const filenameLength = view.getUint16(currentOffset + 28, true);
    const extraFieldLength = view.getUint16(currentOffset + 30, true);
    const commentLength = view.getUint16(currentOffset + 32, true);
    const localHeaderOffset = view.getUint32(currentOffset + 42, true);

    const nameBytes = zipBytes.subarray(currentOffset + 46, currentOffset + 46 + filenameLength);
    const filename = decoder.decode(nameBytes);

    currentOffset += 46 + filenameLength + extraFieldLength + commentLength;

    // Filter out directories and OS hidden metadata
    if (
      filename.endsWith("/") ||
      filename.endsWith("\\") ||
      filename.includes("__MACOSX") ||
      filename.includes(".DS_Store") ||
      filename.includes("Thumbs.db")
    ) {
      continue;
    }

    // Locate file data in Local File Header (sig: 0x04034b50)
    if (localHeaderOffset + 30 <= zipBytes.length) {
      const localSig = view.getUint32(localHeaderOffset, true);
      if (localSig === 0x04034b50) {
        const localNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compressedData = zipBytes.subarray(dataStart, dataStart + compressedSize);

        let uncompressedData: Uint8Array;
        if (compressionMethod === 0) {
          uncompressedData = compressedData;
        } else if (compressionMethod === 8) {
          uncompressedData = await decompressDeflateRaw(compressedData);
        } else {
          // Unsupported compression, store raw
          uncompressedData = compressedData;
        }

        const basename = filename.split("/").pop()!.split("\\").pop()!;
        const ext = basename.includes(".") ? basename.split(".").pop()!.toLowerCase() : "";
        const mimeType = getMimeTypeFromFilename(basename);
        const parsedId = extractIdentifierFromFilename(basename, options);

        // Generate data URL preview for images
        let previewUrl: string | undefined = undefined;
        if (mimeType.startsWith("image/") && uncompressedData.length > 0) {
          try {
            const globalBuf = (globalThis as any).Buffer;
            if (typeof globalBuf !== "undefined") {
              const b64 = globalBuf.from(uncompressedData).toString("base64");
              previewUrl = `data:${mimeType};base64,${b64}`;
            } else if (typeof btoa !== "undefined") {
              let binary = "";
              for (let b = 0; b < uncompressedData.byteLength; b++) {
                binary += String.fromCharCode(uncompressedData[b]!);
              }
              previewUrl = `data:${mimeType};base64,${btoa(binary)}`;
            }
          } catch {
            // ignore preview generation error
          }
        }

        entries.push({
          filename,
          basename,
          extension: ext,
          mimeType,
          size: uncompressedSize || uncompressedData.length,
          identifier: parsedId.identifier,
          variant: parsedId.variant,
          sequence: parsedId.sequence,
          data: uncompressedData,
          previewUrl,
        });
      }
    }
  }

  return entries;
}

/**
 * Matches extracted media files against existing collection records by a specified identifier field (e.g. sku, barcode, slug, id).
 */
export function matchMediaToRecords(
  mediaEntries: IngestedMediaEntry[],
  records: any[],
  options: BulkMediaIngestOptions
): BulkMediaMatchResult {
  const { identifierField, targetField, strategy = "replace" } = options;

  // Build lookup index of records by identifier
  const recordIndex = new Map<string, any>();
  for (const record of records) {
    const val = record[identifierField];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      recordIndex.set(String(val).toLowerCase(), record);
    }
  }

  // Group media files by extracted identifier
  const filesByIdentifier = new Map<string, IngestedMediaEntry[]>();
  const unmatchedFiles: IngestedMediaEntry[] = [];

  for (const file of mediaEntries) {
    const normId = file.identifier.toLowerCase();
    if (recordIndex.has(normId)) {
      if (!filesByIdentifier.has(normId)) {
        filesByIdentifier.set(normId, []);
      }
      filesByIdentifier.get(normId)!.push(file);
    } else {
      unmatchedFiles.push(file);
    }
  }

  const matches: MediaRecordMatch[] = [];
  const matchedRecordIds = new Set<string | number>();

  for (const [normId, files] of filesByIdentifier.entries()) {
    const record = recordIndex.get(normId)!;
    matchedRecordIds.add(record.id);

    // Sort files by sequence number
    files.sort((a, b) => a.sequence - b.sequence);

    const hasExistingImage = Boolean(record[targetField]);
    let status: MediaRecordMatch["status"] = "matched";

    if (hasExistingImage && strategy === "skip") {
      status = "skipped";
    } else if (hasExistingImage) {
      status = "already_has_image";
    }

    matches.push({
      recordId: record.id,
      record,
      identifier: record[identifierField],
      matchedFiles: files,
      status,
      previewUrl: files[0]?.previewUrl,
    });
  }

  const unmatchedRecords = records.filter((r) => !matchedRecordIds.has(r.id));
  let matchedFileCount = 0;
  for (const m of matches) {
    matchedFileCount += m.matchedFiles.length;
  }

  return {
    matches,
    unmatchedFiles,
    unmatchedRecords,
    totalFiles: mediaEntries.length,
    matchedFileCount,
    unmatchedFileCount: unmatchedFiles.length,
  };
}

/**
 * Creates an in-memory valid ZIP archive (STORE compression) for testing and ingestion scenarios.
 */
export function createMockZipArchive(
  files: { name: string; content: string | Uint8Array }[]
): Uint8Array {
  const fileEntries: {
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const encoder = new TextEncoder();

  // Simple standard CRC-32 table calculation
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c;
  }

  const calculateCrc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  let offset = 0;
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = typeof f.content === "string" ? encoder.encode(f.content) : f.content;
    const crc = calculateCrc32(dataBytes);

    fileEntries.push({
      nameBytes,
      dataBytes,
      crc,
      offset,
    });

    // 30 bytes header + name + data
    offset += 30 + nameBytes.length + dataBytes.length;
  }

  let centralDirSize = 0;
  for (const f of fileEntries) {
    centralDirSize += 46 + f.nameBytes.length;
  }

  const totalSize = offset + centralDirSize + 22; // + EOCD 22 bytes
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  // Write Local File Headers
  for (const f of fileEntries) {
    view.setUint32(f.offset, 0x04034b50, true);
    view.setUint16(f.offset + 4, 20, true); // version needed
    view.setUint16(f.offset + 6, 0, true); // flags
    view.setUint16(f.offset + 8, 0, true); // compression = STORE (0)
    view.setUint16(f.offset + 10, 0, true); // time
    view.setUint16(f.offset + 12, 0, true); // date
    view.setUint32(f.offset + 14, f.crc, true);
    view.setUint32(f.offset + 18, f.dataBytes.length, true);
    view.setUint32(f.offset + 22, f.dataBytes.length, true);
    view.setUint16(f.offset + 26, f.nameBytes.length, true);
    view.setUint16(f.offset + 28, 0, true);

    buffer.set(f.nameBytes, f.offset + 30);
    buffer.set(f.dataBytes, f.offset + 30 + f.nameBytes.length);
  }

  // Write Central Directory Headers
  let cdOffset = offset;
  for (const f of fileEntries) {
    view.setUint32(cdOffset, 0x02014b50, true);
    view.setUint16(cdOffset + 4, 20, true); // version made by
    view.setUint16(cdOffset + 6, 20, true); // version needed
    view.setUint16(cdOffset + 8, 0, true); // flags
    view.setUint16(cdOffset + 10, 0, true); // STORE
    view.setUint16(cdOffset + 12, 0, true);
    view.setUint16(cdOffset + 14, 0, true);
    view.setUint32(cdOffset + 16, f.crc, true);
    view.setUint32(cdOffset + 20, f.dataBytes.length, true);
    view.setUint32(cdOffset + 24, f.dataBytes.length, true);
    view.setUint16(cdOffset + 28, f.nameBytes.length, true);
    view.setUint16(cdOffset + 30, 0, true);
    view.setUint16(cdOffset + 32, 0, true);
    view.setUint16(cdOffset + 34, 0, true);
    view.setUint16(cdOffset + 36, 0, true);
    view.setUint32(cdOffset + 38, 0, true);
    view.setUint32(cdOffset + 42, f.offset, true);

    buffer.set(f.nameBytes, cdOffset + 46);
    cdOffset += 46 + f.nameBytes.length;
  }

  // Write EOCD
  view.setUint32(cdOffset, 0x06054b50, true);
  view.setUint16(cdOffset + 4, 0, true);
  view.setUint16(cdOffset + 6, 0, true);
  view.setUint16(cdOffset + 8, fileEntries.length, true);
  view.setUint16(cdOffset + 10, fileEntries.length, true);
  view.setUint32(cdOffset + 12, centralDirSize, true);
  view.setUint32(cdOffset + 16, offset, true);
  view.setUint16(cdOffset + 20, 0, true);

  return buffer;
}
