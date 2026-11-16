import { describe, it, expect, vi } from "vitest";
import {
  parseCsv,
  serializeCsv,
  generateCsvTemplate,
  chunkArray,
  importInChunks,
} from "../src/import/csv.js";

describe("CSV Parsing and Serialization Engine", () => {
  it("parses basic CSV content into headers and records", () => {
    const csv = "name,email,role\nAlice,alice@example.com,admin\nBob,bob@example.com,user";
    const res = parseCsv(csv);

    expect(res.headers).toEqual(["name", "email", "role"]);
    expect(res.totalRows).toBe(2);
    expect(res.rows[0]).toEqual({
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
    });
    expect(res.rows[1]).toEqual({
      name: "Bob",
      email: "bob@example.com",
      role: "user",
    });
  });

  it("handles quoted cells with commas, escaped quotes, and newlines (RFC 4180)", () => {
    const csv = `title,description,price\r\n"Item, with comma","Line 1\nLine 2",19.99\r\n"He said ""Hello""",Simple,29.99`;
    const res = parseCsv(csv);

    expect(res.headers).toEqual(["title", "description", "price"]);
    expect(res.totalRows).toBe(2);
    expect(res.rows[0].title).toBe("Item, with comma");
    expect(res.rows[0].description).toBe("Line 1\nLine 2");
    expect(res.rows[0].price).toBe("19.99");
    expect(res.rows[1].title).toBe('He said "Hello"');
    expect(res.rows[1].description).toBe("Simple");
  });

  it("auto-detects tab delimiter (TSV)", () => {
    const tsv = "col1\tcol2\tcol3\nval1\tval2\tval3";
    const res = parseCsv(tsv);

    expect(res.headers).toEqual(["col1", "col2", "col3"]);
    expect(res.rows[0]).toEqual({ col1: "val1", col2: "val2", col3: "val3" });
  });

  it("serializes records to CSV with RFC 4180 escaping", () => {
    const headers = ["title", "notes"];
    const rows = [
      { title: "Standard", notes: "clean" },
      { title: "Quoted, comma", notes: 'Includes "quote"' },
    ];

    const csv = serializeCsv(headers, rows);
    expect(csv).toContain('title,notes\r\n');
    expect(csv).toContain('Standard,clean\r\n');
    expect(csv).toContain('"Quoted, comma","Includes ""quote"""');
  });

  it("generates sample CSV template from field definitions", () => {
    const fields = [
      { key: "title", label: "Title" },
      { key: "email", label: "Email" },
      { key: "price", label: "Price" },
      { key: "category", label: "Category", sample: "Electronics" },
    ];

    const template = generateCsvTemplate(fields);
    expect(template).toContain("title,email,price,category");
    expect(template).toContain("Electronics");
    expect(template).toContain("user@example.com");
  });
});

describe("Batch Import Chunking and Orchestration", () => {
  it("splits records into chunks correctly", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const chunks = chunkArray(items, 3);

    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("processes imports in chunks with progress reporting and error aggregation", async () => {
    const rows = [
      { id: 1, name: "Row 1" },
      { id: 2, name: "Row 2" },
      { id: 3, name: "Row 3" },
      { id: 4, name: "Row 4" },
    ];

    const progressCalls: any[] = [];
    const mockOnChunk = vi.fn().mockImplementation(async (chunk, index) => {
      if (index === 0) {
        return { creates: [chunk[0], chunk[1]], updates: [], errors: [] };
      } else {
        return {
          creates: [chunk[0]],
          updates: [],
          errors: [{ index: 1, error: "Validation failed on Row 4" }],
        };
      }
    });

    const summary = await importInChunks({
      rows,
      chunkSize: 2,
      onChunk: mockOnChunk,
      onProgress: (p) => progressCalls.push({ ...p }),
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(2);
    expect(summary.totalCreated).toBe(3);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].index).toBe(3); // Global index: 2 + 1 = 3
    expect(summary.errors[0].error).toContain("Row 4");

    expect(progressCalls.length).toBe(2);
    expect(progressCalls[1].processed).toBe(4);
    expect(progressCalls[1].percent).toBe(100);
  });
});
