import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  Barcode,
  QRCode,
  encodeBarcode,
  encodeQRCode,
} from "../src/index.js";

describe("Barcode visual rendering primitive", () => {
  it("encodes and renders Code128 barcode SVG with text", () => {
    const html = renderToString(<Barcode value="SKU-12345" />);
    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Barcode: SKU-12345"');
    expect(html).toContain("<rect");
    expect(html).toContain("SKU-12345");
  });

  it("supports Code39 format", () => {
    const html = renderToString(<Barcode value="CODE-39" format="code39" />);
    expect(html).toContain("<svg");
    expect(html).toContain("CODE-39");
    expect(html).toContain("<rect");
  });

  it("supports EAN-13 format", () => {
    const html = renderToString(<Barcode value="4006381333931" format="ean13" />);
    expect(html).toContain("<svg");
    expect(html).toContain("4006381333931");
  });

  it("supports UPC-A format", () => {
    const html = renderToString(<Barcode value="012345678905" format="upca" />);
    expect(html).toContain("<svg");
    expect(html).toContain("012345678905");
  });

  it("can suppress text display with displayValue={false}", () => {
    const html = renderToString(<Barcode value="SECRET-CODE" displayValue={false} />);
    expect(html).toContain("<svg");
    expect(html).not.toContain("<text");
  });

  it("supports custom colors and backgrounds", () => {
    const html = renderToString(
      <Barcode value="COLORED" lineColor="#ff0000" background="#ffff00" />
    );
    expect(html).toContain('fill="#ffff00"');
    expect(html).toContain('fill="#ff0000"');
  });

  it("encodeBarcode utility returns modules", () => {
    const encoded = encodeBarcode("TEST-123");
    expect(encoded.modules.length).toBeGreaterThan(0);
    expect(encoded.text).toBe("TEST-123");
  });
});

describe("QRCode visual rendering primitive", () => {
  it("encodes and renders QR code SVG", () => {
    const html = renderToString(<QRCode value="https://honocube.dev" />);
    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="QR Code: https://honocube.dev"');
    expect(html).toContain("<path");
    expect(html).toContain('shape-rendering="crispEdges"');
  });

  it("applies custom size and colors", () => {
    const html = renderToString(
      <QRCode value="CUSTOM" size={240} fgColor="#003366" bgColor="#f0f0f0" />
    );
    expect(html).toContain('width="240"');
    expect(html).toContain('height="240"');
    expect(html).toContain('fill="#003366"');
    expect(html).toContain('fill="#f0f0f0"');
  });

  it("supports error correction levels L, M, Q, H", () => {
    const htmlL = renderToString(<QRCode value="RECOVERY" level="L" />);
    const htmlH = renderToString(<QRCode value="RECOVERY" level="H" />);
    expect(htmlL).toContain("<svg");
    expect(htmlH).toContain("<svg");
  });

  it("supports quiet zone margin", () => {
    const html = renderToString(<QRCode value="MARGIN-TEST" includeMargin={true} marginSize={4} />);
    expect(html).toContain("<svg");
  });

  it("renders embedded center logo image", () => {
    const html = renderToString(
      <QRCode
        value="https://honocube.dev/products"
        imageSettings={{ src: "/assets/brand-logo.png", width: 32, height: 32 }}
      />
    );
    expect(html).toContain("<image");
    expect(html).toContain('href="/assets/brand-logo.png"');
  });

  it("encodeQRCode utility produces modules matrix", () => {
    const qr = encodeQRCode("MATRIX-TEST");
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.modules.length).toBe(qr.size);
    expect(qr.modules[0]!.length).toBe(qr.size);
  });
});
