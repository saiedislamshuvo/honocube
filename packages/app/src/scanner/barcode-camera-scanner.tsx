import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, SwitchCamera, Zap, AlertCircle, Check } from "lucide-react";
import { Button, Input } from "@honocube/ui";
import type { BarcodeCameraScannerProps } from "@honocube/core";
import { playScanBeep } from "./use-barcode-scanner.js";

interface BarcodeDetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorInstance;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

export function BarcodeCameraScanner({
  onScan,
  onError,
  facingMode: initialFacingMode = "environment",
  torch: initialTorch = false,
  className = "",
}: BarcodeCameraScannerProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(initialFacingMode);
  const [torch, setTorch] = useState(initialTorch);
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const isScanningRef = useRef(true);

  const handleDetected = useCallback(
    (code: string) => {
      if (!isScanningRef.current || !code.trim()) return;
      isScanningRef.current = false;
      setLastScanned(code);
      playScanBeep();
      onScan(code);
      setTimeout(() => {
        isScanningRef.current = true;
      }, 1500);
    },
    [onScan]
  );

  // Initialize Camera Stream
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setErrorMessage("Camera access is not supported by your browser environment.");
        return;
      }

      try {
        setErrorMessage(null);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities?.() || {}) as Record<string, unknown>;
          setHasTorch(Boolean(capabilities.torch));
        }
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Failed to access camera.";
        setErrorMessage(msg);
        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, onError]);

  // Flashlight / Torch Toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torch;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorch(nextTorch);
    } catch {
      // Torch constraint not supported
    }
  };

  // Toggle Camera Facing Mode
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Native BarcodeDetector Frame Loop (when available)
  useEffect(() => {
    if (typeof window === "undefined" || !window.BarcodeDetector) return;

    let detector: BarcodeDetectorInstance | null = null;
    try {
      detector = new window.BarcodeDetector();
    } catch {
      return;
    }

    let frameId: number;
    const scanFrame = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && isScanningRef.current && detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0]?.rawValue) {
            handleDetected(barcodes[0].rawValue);
          }
        } catch {
          // Detection frame error
        }
      }
      frameId = requestAnimationFrame(scanFrame);
    };

    frameId = requestAnimationFrame(scanFrame);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [handleDetected]);

  return (
    <div
      data-testid="barcode-camera-scanner"
      className={`relative flex flex-col items-center bg-black rounded-lg overflow-hidden ${className}`}
    >
      {/* Video Viewfinder Container */}
      <div className="relative w-full aspect-video sm:aspect-square max-h-[380px] flex items-center justify-center bg-neutral-950 overflow-hidden">
        {errorMessage ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="font-semibold text-foreground mb-1">Camera Stream Unavailable</p>
            <p className="max-w-xs">{errorMessage}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              data-testid="scanner-video-feed"
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Target Reticle Overlay */}
            <div
              data-testid="scanner-target-reticle"
              className="absolute inset-8 sm:inset-12 border-2 border-primary/40 rounded-lg pointer-events-none flex flex-col justify-between p-2"
            >
              {/* Corner markers */}
              <div className="flex justify-between w-full">
                <span className="w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-sm -mt-1 -ml-1" />
                <span className="w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-sm -mt-1 -mr-1" />
              </div>

              {/* Animated Laser Scanning Line */}
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse" />

              <div className="flex justify-between w-full">
                <span className="w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-sm -mb-1 -ml-1" />
                <span className="w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-sm -mb-1 -mr-1" />
              </div>
            </div>

            {/* Success Scan Flash */}
            {lastScanned && !isScanningRef.current && (
              <div
                data-testid="scan-success-indicator"
                className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center text-white font-mono text-sm font-bold gap-2 animate-in fade-in duration-150"
              >
                <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1.5 rounded-full shadow-lg">
                  <Check className="h-4 w-4" />
                  <span>{lastScanned}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Viewfinder Controls Toolbar (Top Right Overlay) */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {hasTorch && (
            <Button
              type="button"
              variant={torch ? "default" : "secondary"}
              size="icon"
              onClick={toggleTorch}
              data-testid="torch-toggle-button"
              className="h-8 w-8 rounded-full shadow-md bg-black/60 text-white hover:bg-black/80"
              title={torch ? "Turn Flashlight Off" : "Turn Flashlight On"}
            >
              <Zap className={`h-4 w-4 ${torch ? "text-amber-400 fill-amber-400" : ""}`} />
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={toggleCamera}
            data-testid="camera-switch-button"
            className="h-8 w-8 rounded-full shadow-md bg-black/60 text-white hover:bg-black/80"
            title="Switch Camera (Front / Rear)"
          >
            <SwitchCamera className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Manual / Simulated Input Form */}
      <div className="w-full p-3 bg-card border-t border-border flex items-center gap-2">
        <Input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Manual code entry or scanner input..."
          data-testid="manual-barcode-input"
          className="text-xs h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualCode.trim()) {
              e.preventDefault();
              handleDetected(manualCode.trim());
              setManualCode("");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (manualCode.trim()) {
              handleDetected(manualCode.trim());
              setManualCode("");
            }
          }}
          disabled={!manualCode.trim()}
          data-testid="manual-submit-button"
          className="h-8 px-3 text-xs shrink-0"
        >
          <Camera className="h-3.5 w-3.5 mr-1" />
          <span>Scan Code</span>
        </Button>
      </div>
    </div>
  );
}
