import { describe, it, expect } from "vitest";
import {
  getMimeTypeFromFilename,
  extractIdentifierFromFilename,
  createMockZipArchive,
  extractZipArchive,
  matchMediaToRecords,
} from "../src/media/zip-ingest.js";

describe("zip-ingest media utilities", () => {
  describe("getMimeTypeFromFilename", () => {
    it("detects image and document mime types", () => {
      expect(getMimeTypeFromFilename("photo.jpg")).toBe("image/jpeg");
      expect(getMimeTypeFromFilename("photo.jpeg")).toBe("image/jpeg");
      expect(getMimeTypeFromFilename("icon.png")).toBe("image/png");
      expect(getMimeTypeFromFilename("banner.webp")).toBe("image/webp");
      expect(getMimeTypeFromFilename("anim.gif")).toBe("image/gif");
      expect(getMimeTypeFromFilename("vector.svg")).toBe("image/svg+xml");
      expect(getMimeTypeFromFilename("nextgen.avif")).toBe("image/avif");
      expect(getMimeTypeFromFilename("bitmap.bmp")).toBe("image/bmp");
      expect(getMimeTypeFromFilename("spec.pdf")).toBe("application/pdf");
      expect(getMimeTypeFromFilename("unknown.xyz")).toBe("application/octet-stream");
    });
  });

  describe("extractIdentifierFromFilename", () => {
    it("extracts identifier with prefix_delimiter by default", () => {
      const res1 = extractIdentifierFromFilename("SKU-1001.jpg");
      expect(res1.identifier).toBe("SKU-1001");
      expect(res1.sequence).toBe(0);
      expect(res1.variant).toBeUndefined();

      const res2 = extractIdentifierFromFilename("SKU-1001_1.jpg");
      expect(res2.identifier).toBe("SKU-1001");
      expect(res2.sequence).toBe(1);
      expect(res2.variant).toBe("1");

      const res3 = extractIdentifierFromFilename("SKU-1001_thumb.png");
      expect(res3.identifier).toBe("SKU-1001");
      expect(res3.sequence).toBe(0);
      expect(res3.variant).toBe("thumb");

      const res4 = extractIdentifierFromFilename("nested/folder/SKU-1001_3.webp");
      expect(res4.identifier).toBe("SKU-1001");
      expect(res4.sequence).toBe(3);
    });

    it("supports custom delimiter", () => {
      const res = extractIdentifierFromFilename("ITEM-01-2.jpg", { delimiter: "-" });
      expect(res.identifier).toBe("ITEM-01");
      expect(res.sequence).toBe(2);
      expect(res.variant).toBe("2");
    });

    it("supports exact pattern", () => {
      const res = extractIdentifierFromFilename("ITEM_01_2.jpg", { pattern: "exact" });
      expect(res.identifier).toBe("ITEM_01_2");
      expect(res.sequence).toBe(0);
    });

    it("supports custom_regex pattern", () => {
      const res = extractIdentifierFromFilename("PROD-888-v2.png", {
        pattern: "custom_regex",
        customRegex: /^([A-Z]+-\d+)-(v\d+)$/,
      });
      expect(res.identifier).toBe("PROD-888");
      expect(res.variant).toBe("v2");
    });
  });

  describe("createMockZipArchive and extractZipArchive", () => {
    it("creates and extracts in-memory ZIP archives, filtering OS metadata", async () => {
      const zipData = createMockZipArchive([
        { name: "SKU-101.jpg", content: "fake-jpg-content-101" },
        { name: "SKU-101_1.png", content: "fake-png-content-101-1" },
        { name: "SKU-102.webp", content: "fake-webp-content-102" },
        { name: "__MACOSX/._SKU-101.jpg", content: "apple-double-resource" },
        { name: "subfolder/.DS_Store", content: "ds-store-binary" },
        { name: "Thumbs.db", content: "windows-thumbs" },
      ]);

      expect(zipData.length).toBeGreaterThan(0);

      const entries = await extractZipArchive(zipData);
      // The 3 OS metadata entries should be filtered out
      expect(entries).toHaveLength(3);

      const e1 = entries.find((e) => e.basename === "SKU-101.jpg");
      expect(e1).toBeDefined();
      expect(e1?.identifier).toBe("SKU-101");
      expect(e1?.mimeType).toBe("image/jpeg");
      expect(e1?.previewUrl).toContain("data:image/jpeg;base64,");

      const e2 = entries.find((e) => e.basename === "SKU-101_1.png");
      expect(e2).toBeDefined();
      expect(e2?.identifier).toBe("SKU-101");
      expect(e2?.variant).toBe("1");
      expect(e2?.sequence).toBe(1);

      const e3 = entries.find((e) => e.basename === "SKU-102.webp");
      expect(e3).toBeDefined();
      expect(e3?.identifier).toBe("SKU-102");
    });

    it("throws an error when passing non-ZIP data", async () => {
      const invalidBytes = new Uint8Array([1, 2, 3, 4, 5]);
      await expect(extractZipArchive(invalidBytes)).rejects.toThrow("Invalid ZIP archive");
    });
  });

  describe("matchMediaToRecords", () => {
    const mockRecords = [
      { id: "rec-1", sku: "SKU-101", title: "Product 101", image: null },
      { id: "rec-2", sku: "SKU-102", title: "Product 102", image: "https://example.com/old.jpg" },
      { id: "rec-3", sku: "SKU-103", title: "Product 103", image: null },
    ];

    it("matches media files to records by identifier and respects strategy", async () => {
      const zipData = createMockZipArchive([
        { name: "SKU-101.jpg", content: "image-1" },
        { name: "SKU-101_1.jpg", content: "image-1-variant" },
        { name: "SKU-102.png", content: "image-2" },
        { name: "SKU-999.jpg", content: "orphan-image" },
      ]);

      const mediaEntries = await extractZipArchive(zipData);

      // Strategy: replace
      const result = matchMediaToRecords(mediaEntries, mockRecords, {
        identifierField: "sku",
        targetField: "image",
        strategy: "replace",
      });

      expect(result.totalFiles).toBe(4);
      expect(result.matchedFileCount).toBe(3);
      expect(result.unmatchedFileCount).toBe(1);
      expect(result.unmatchedFiles[0]?.identifier).toBe("SKU-999");
      expect(result.unmatchedRecords).toHaveLength(1);
      expect(result.unmatchedRecords[0].sku).toBe("SKU-103");

      const match101 = result.matches.find((m) => m.identifier === "SKU-101");
      expect(match101).toBeDefined();
      expect(match101?.status).toBe("matched");
      expect(match101?.matchedFiles).toHaveLength(2);

      const match102 = result.matches.find((m) => m.identifier === "SKU-102");
      expect(match102).toBeDefined();
      expect(match102?.status).toBe("already_has_image");

      // Strategy: skip
      const skipResult = matchMediaToRecords(mediaEntries, mockRecords, {
        identifierField: "sku",
        targetField: "image",
        strategy: "skip",
      });
      const skipMatch102 = skipResult.matches.find((m) => m.identifier === "SKU-102");
      expect(skipMatch102?.status).toBe("skipped");
    });
  });
});
