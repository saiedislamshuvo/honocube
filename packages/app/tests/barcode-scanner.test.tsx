import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import {
  useBarcodeScanner,
  BarcodeCameraScanner,
  BarcodeScannerDialog,
  ScanVerificationWidget,
  BarcodeField,
  QRCodeField,
  type VerificationItem,
} from "../src/index.js";

// Helper component for testing useBarcodeScanner
function ScannerConsumer({
  onScan,
  enabled = true,
}: {
  onScan: (code: string) => void;
  enabled?: boolean;
}): React.JSX.Element {
  const { simulateScan } = useBarcodeScanner({
    onScan,
    enabled,
    minLength: 3,
  });

  return (
    <button
      type="button"
      data-testid="simulate-btn"
      onClick={() => simulateScan("SKU-9900")}
    >
      Simulate
    </button>
  );
}

describe("Barcode & QR Code Scanner Integration (Issue #123)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useBarcodeScanner Hook Logic", () => {
    it("provides simulateScan function to trigger manual scan events", () => {
      const handleScan = vi.fn();
      const html = renderToString(<ScannerConsumer onScan={handleScan} />);
      expect(html).toContain('data-testid="simulate-btn"');
    });
  });

  describe("BarcodeCameraScanner Component", () => {
    it("renders video element, reticle overlay, laser line, and controls", () => {
      const html = renderToString(
        <BarcodeCameraScanner onScan={vi.fn()} />
      );

      expect(html).toContain('data-testid="barcode-camera-scanner"');
      expect(html).toContain('data-testid="scanner-video-feed"');
      expect(html).toContain('data-testid="scanner-target-reticle"');
      expect(html).toContain('data-testid="camera-switch-button"');
      expect(html).toContain('data-testid="manual-barcode-input"');
      expect(html).toContain('data-testid="manual-submit-button"');
      expect(html).toContain("Scan Code");
    });
  });

  describe("BarcodeScannerDialog Component", () => {
    it("renders modal dialog container with camera scanner and close action", () => {
      const html = renderToString(
        <BarcodeScannerDialog
          open={true}
          onOpenChange={vi.fn()}
          onScan={vi.fn()}
          title="Warehouse Barcode Scanner"
        />
      );

      expect(html).toContain('data-testid="barcode-scanner-dialog"');
      expect(html).toContain("Warehouse Barcode Scanner");
      expect(html).toContain('data-testid="scanner-dialog-close"');
      expect(html).toContain('data-testid="barcode-camera-scanner"');
    });

    it("renders trigger element when closed", () => {
      const html = renderToString(
        <BarcodeScannerDialog
          open={false}
          onOpenChange={vi.fn()}
          onScan={vi.fn()}
          trigger={<button id="open-scanner">Open Scanner</button>}
        />
      );

      expect(html).toContain('id="open-scanner"');
      expect(html).not.toContain('data-testid="barcode-camera-scanner"');
    });
  });

  describe("ScanVerificationWidget Component", () => {
    const mockItems: VerificationItem[] = [
      {
        id: "item-1",
        name: "Industrial Pallet Jack 5000lb",
        sku: "SKU-PJ5000",
        barcode: "088219001234",
        expectedQuantity: 2,
        verifiedQuantity: 0,
      },
      {
        id: "item-2",
        name: "Polyurethane Wheel Replacement Set",
        sku: "SKU-WH200",
        barcode: "088219005678",
        expectedQuantity: 4,
        verifiedQuantity: 0,
      },
    ];

    it("renders verification table with progress bar and pending status badges", () => {
      const html = renderToString(
        <ScanVerificationWidget
          items={mockItems}
          title="Outbound Shipment Audit"
        />
      );

      expect(html).toContain('data-testid="scan-verification-widget"');
      expect(html).toContain("Outbound Shipment Audit");
      expect(html).toContain("Overall Verification Progress");
      expect(html).toContain("0 / 6 Units (0%)");
      expect(html).toContain('data-testid="verification-progress-bar"');
      expect(html).toContain("Industrial Pallet Jack 5000lb");
      expect(html).toContain("SKU-PJ5000");
      expect(html).toContain("088219001234");
      expect(html).toContain("PENDING");
      expect(html).toContain('data-testid="verification-camera-button"');
      expect(html).toContain('data-testid="verification-manual-input"');
    });

    it("renders completed state when all items are verified", () => {
      const completedItems: VerificationItem[] = [
        {
          id: "item-1",
          name: "Industrial Pallet Jack 5000lb",
          barcode: "088219001234",
          expectedQuantity: 2,
          verifiedQuantity: 2,
          status: "verified",
        },
      ];

      const html = renderToString(
        <ScanVerificationWidget items={completedItems} />
      );

      expect(html).toContain("2 / 2 Units (100%)");
      expect(html).toContain("VERIFIED");
      expect(html).toContain('data-testid="verification-complete-banner"');
      expect(html).toContain("All items fully picked and verified!");
    });
  });

  describe("BarcodeField & QRCodeField Scanner Button Integration", () => {
    it("renders Scan button in BarcodeField when showScanner is enabled", () => {
      const html = renderToString(
        <BarcodeField name="barcode" onChange={vi.fn()} showScanner={true} />
      );

      expect(html).toContain('data-testid="barcode-scan-button"');
      expect(html).toContain("Scan");
    });

    it("renders Scan button in QRCodeField when showScanner is enabled", () => {
      const html = renderToString(
        <QRCodeField name="qr" onChange={vi.fn()} showScanner={true} />
      );

      expect(html).toContain('data-testid="qrcode-scan-button"');
      expect(html).toContain("Scan");
    });
  });
});
