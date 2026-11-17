import * as React from "react";
import { Button } from "@honocube/ui";
import type { SignaturePadProps } from "@honocube/core";

interface Point {
  x: number;
  y: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  id,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  penColor = "#0f172a",
  backgroundColor = "transparent",
  penWidth = 2.5,
  width = 440,
  height = 160,
  format = "image/png",
  signerName,
  signedAt,
  hasError = false,
  className = "",
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [strokes, setStrokes] = React.useState<Point[][]>([]);
  const [isEditing, setIsEditing] = React.useState(!value);

  // Redraw canvas whenever strokes, penColor, or dimensions change
  const redrawCanvas = React.useCallback(
    (strokeList: Point[][]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const stroke of strokeList) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        const start = stroke[0]!;
        ctx.moveTo(start.x, start.y);

        if (stroke.length === 1) {
          ctx.lineTo(start.x + 0.1, start.y + 0.1);
        } else {
          for (let i = 1; i < stroke.length; i++) {
            const p = stroke[i]!;
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
      }
    },
    [penColor, penWidth, backgroundColor]
  );

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || readOnly) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails in test environments
    }
    const pt = getCanvasCoords(e);
    setIsDrawing(true);
    const newStrokes = [...strokes, [pt]];
    setStrokes(newStrokes);
    redrawCanvas(newStrokes);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || readOnly) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);
    setStrokes((prev) => {
      const lastStroke = prev[prev.length - 1];
      if (!lastStroke) return prev;
      const updatedLast = [...lastStroke, pt];
      const updated = [...prev.slice(0, -1), updatedLast];
      redrawCanvas(updated);
      return updated;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore in tests
    }

    const canvas = canvasRef.current;
    if (canvas && strokes.length > 0) {
      try {
        const dataUrl = canvas.toDataURL(format);
        onChange(dataUrl);
      } catch {
        // Fallback if toDataURL fails (e.g. mock canvas in SSR)
      }
    }
  };

  const handleClear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange(null);
  };

  const handleUndo = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      redrawCanvas(next);
      const canvas = canvasRef.current;
      if (canvas) {
        if (next.length > 0) {
          try {
            onChange(canvas.toDataURL(format));
          } catch {
            // Ignore
          }
        } else {
          onChange(null);
        }
      }
      return next;
    });
  };

  // If we already have a saved signature value and are not in edit mode
  if (value && !isEditing) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative p-3 bg-muted/20 rounded-lg border border-border flex flex-col items-center justify-center min-h-[140px]">
          <img
            src={value}
            alt="Handwritten digital signature"
            className="max-h-[120px] max-w-full object-contain select-none"
          />
          {(signerName || signedAt) && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              {signerName && <span className="font-medium text-foreground">{signerName}</span>}
              {signerName && signedAt && <span>•</span>}
              {signedAt && <span>{signedAt}</span>}
            </div>
          )}
        </div>
        {!readOnly && !disabled && (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(true);
                setStrokes([]);
              }}
              className="text-xs h-8 px-2.5"
            >
              Clear & Re-sign
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ReadOnly state without an existing signature
  if ((readOnly || disabled) && !value) {
    return (
      <div className={`p-4 bg-muted/20 rounded-lg border border-dashed text-xs text-muted-foreground text-center ${className}`}>
        No signature recorded
      </div>
    );
  }

  return (
    <div className={`space-y-2 select-none ${className}`}>
      <div
        className={`relative rounded-lg border overflow-hidden bg-background ${
          hasError ? "border-destructive ring-1 ring-destructive" : "border-border"
        }`}
        style={{ maxWidth: "100%", width: "100%" }}
      >
        <canvas
          ref={canvasRef}
          id={id || name}
          width={width}
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-auto block touch-none cursor-crosshair bg-card"
          style={{ height: `${height}px` }}
          aria-label="Digital signature canvas"
        />

        {/* Visual guideline for signers */}
        <div className="pointer-events-none absolute bottom-6 left-6 right-6 flex items-center gap-2 opacity-40">
          <span className="font-serif text-xs font-semibold text-muted-foreground">✕</span>
          <div className="flex-1 border-b border-muted-foreground/60" />
          <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Sign above line
          </span>
        </div>
      </div>

      {/* Action controls */}
      {!readOnly && !disabled && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {signerName && (
              <span>
                Signing as: <strong className="text-foreground">{signerName}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="text-xs h-7 px-2"
            >
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={strokes.length === 0 && !value}
              className="text-xs h-7 px-2 text-destructive hover:text-destructive"
            >
              Clear
            </Button>
            {value && isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="text-xs h-7 px-2"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

SignaturePad.displayName = "SignaturePad";
