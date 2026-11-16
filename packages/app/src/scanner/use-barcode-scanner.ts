import { useEffect, useRef, useCallback } from "react";
import type { BarcodeScannerOptions } from "@honocube/core";

/**
 * Play a high-pitch beep for positive scan feedback
 */
export function playScanBeep(frequency = 1200, durationMs = 80): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      ctx.currentTime + durationMs / 1000
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, durationMs + 50);
  } catch {
    // AudioContext may be blocked by autoplay policies
  }
}

/**
 * Hook to listen for USB/Bluetooth HID hardware barcode scanners acting as a keyboard wedge.
 * Fast keystrokes (<50ms interval) terminated by Enter are detected as a barcode scan.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 3,
  maxIntervalMs = 50,
  preventDefault = false,
  sound = true,
}: BarcodeScannerOptions): {
  simulateScan: (barcode: string) => void;
} {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleScan = useCallback(
    (scannedCode: string) => {
      if (!scannedCode || scannedCode.length < minLength) return;
      if (sound) {
        playScanBeep();
      }
      onScanRef.current(scannedCode);
    },
    [minLength, sound]
  );

  const simulateScan = useCallback(
    (code: string) => {
      handleScan(code);
    },
    [handleScan]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key marks end of barcode scanner transmission
      if (event.key === "Enter") {
        if (bufferRef.current.length >= minLength) {
          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          const scanned = bufferRef.current;
          bufferRef.current = "";
          handleScan(scanned);
          return;
        }
        bufferRef.current = "";
        return;
      }

      // If key was pressed after longer delay than maxIntervalMs, human typed it; reset buffer
      if (elapsed > maxIntervalMs) {
        bufferRef.current = "";
      }

      // Accumulate printable ASCII characters
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, minLength, maxIntervalMs, preventDefault, handleScan]);

  return { simulateScan };
}
