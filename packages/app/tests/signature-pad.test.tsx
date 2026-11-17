import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  f,
  AppProvider,
  FormView,
  SignaturePad,
} from "../src/index.js";

describe("Digital Signature Capture Canvas (Issue #130)", () => {
  describe("f.signature() Fluent Builder", () => {
    it("builds a signature field config with default properties", () => {
      const field = f.signature("Customer Signature").build();

      expect(field.type).toBe("signature");
      expect(field.label).toBe("Customer Signature");
      expect(field.penColor).toBe("#000000");
      expect(field.penWidth).toBe(2);
      expect(field.width).toBe(400);
      expect(field.height).toBe(160);
      expect(field.format).toBe("image/png");
    });

    it("supports fluent chaining of styling and companion fields", () => {
      const field = f
        .signature("Approval Sign-off")
        .penColor("#003366")
        .backgroundColor("#fafafa")
        .penWidth(3.5)
        .dimensions(500, 220)
        .format("image/svg+xml")
        .signerNameField("approver_name")
        .signedAtField("approval_timestamp")
        .build();

      expect(field.penColor).toBe("#003366");
      expect(field.backgroundColor).toBe("#fafafa");
      expect(field.penWidth).toBe(3.5);
      expect(field.width).toBe(500);
      expect(field.height).toBe(220);
      expect(field.format).toBe("image/svg+xml");
      expect(field.signerNameField).toBe("approver_name");
      expect(field.signedAtField).toBe("approval_timestamp");
    });
  });

  describe("SignaturePad Component Rendering", () => {
    it("renders canvas and visual guideline when no signature exists", () => {
      const html = renderToString(
        <SignaturePad name="sig" onChange={vi.fn()} width={450} height={180} />
      );

      expect(html).toContain("<canvas");
      expect(html).toContain('width="450"');
      expect(html).toContain('height="180"');
      expect(html).toContain("Sign above line");
      expect(html).toContain("✕");
      expect(html).toContain("Clear");
      expect(html).toContain("Undo");
    });

    it("displays signer name indicator when provided", () => {
      const html = renderToString(
        <SignaturePad
          name="sig"
          signerName="Johnathan Doe, Director"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Signing as:");
      expect(html).toContain("Johnathan Doe, Director");
    });

    it("renders existing signature preview image and re-sign button", () => {
      const existingSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const html = renderToString(
        <SignaturePad
          name="sig"
          value={existingSig}
          signerName="Alice Smith"
          signedAt="2026-11-16 10:30 AM"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("<img");
      expect(html).toContain(`src="${existingSig}"`);
      expect(html).toContain("Alice Smith");
      expect(html).toContain("2026-11-16 10:30 AM");
      expect(html).toContain("Clear &amp; Re-sign");
      expect(html).not.toContain("<canvas");
    });

    it("renders clean read-only preview without edit controls", () => {
      const existingSig = "data:image/png;base64,test-signature";
      const html = renderToString(
        <SignaturePad
          name="sig"
          value={existingSig}
          readOnly={true}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("<img");
      expect(html).not.toContain("Clear &amp; Re-sign");
      expect(html).not.toContain("<canvas");
    });

    it("renders empty placeholder note in read-only mode without signature", () => {
      const html = renderToString(
        <SignaturePad name="sig" readOnly={true} onChange={vi.fn()} />
      );

      expect(html).toContain("No signature recorded");
      expect(html).not.toContain("<canvas");
      expect(html).not.toContain("<img");
    });

    it("applies error styling when hasError is true", () => {
      const html = renderToString(
        <SignaturePad name="sig" hasError={true} onChange={vi.fn()} />
      );

      expect(html).toContain("border-destructive");
      expect(html).toContain("ring-destructive");
    });
  });

  describe("FormField Integration in FormView", () => {
    it("renders signature field inside FormView with companion fields", () => {
      const contracts = defineCollection({
        name: "contracts",
        fields: {
          title: f.text("Contract Title").required(),
          signer_name: f.text("Signer Name"),
          signature: f
            .signature("Authorized Signature")
            .signerNameField("signer_name")
            .dimensions(460, 150),
        },
      });

      const app = defineApp({
        title: "Contract Agreements App",
        apiBaseUrl: "/api",
        collections: [contracts],
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app}>
            <FormView
              collection={contracts}
              initialValues={{
                title: "Vendor Master Services Agreement",
                signer_name: "Sarah Jenkins, CTO",
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Vendor Master Services Agreement");
      expect(html).toContain("Authorized Signature");
      expect(html).toContain("Signing as:");
      expect(html).toContain("Sarah Jenkins, CTO");
      expect(html).toContain("<canvas");
      expect(html).toContain("Sign above line");
    });
  });
});
