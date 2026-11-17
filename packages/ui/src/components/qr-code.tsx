import * as React from "react";
import { cn } from "../lib/utils.js";
import { encodeQRCode, type QrErrorCorrectionLevel } from "../lib/qrcode-encoder.js";

export type { QrErrorCorrectionLevel };

export interface QRCodeImageSettings {
  src: string;
  width?: number;
  height?: number;
  excavate?: boolean;
}

export interface QRCodeProps extends React.SVGAttributes<SVGSVGElement> {
  value: string;
  size?: number;
  level?: QrErrorCorrectionLevel;
  fgColor?: string;
  bgColor?: string;
  includeMargin?: boolean;
  marginSize?: number;
  imageSettings?: QRCodeImageSettings;
  className?: string;
}

export const QRCode = React.forwardRef<SVGSVGElement, QRCodeProps>(
  (
    {
      value,
      size = 160,
      level = "M",
      fgColor = "currentColor",
      bgColor = "transparent",
      includeMargin = false,
      marginSize = 4,
      imageSettings,
      className,
      ...props
    },
    ref
  ) => {
    const { matrixSize, pathData } = React.useMemo(() => {
      try {
        const { size: mSize, modules } = encodeQRCode(value, level);
        const margin = includeMargin ? marginSize : 0;
        const total = mSize + margin * 2;

        let excMinX = -1;
        let excMaxX = -1;
        let excMinY = -1;
        let excMaxY = -1;

        if (imageSettings && imageSettings.excavate !== false) {
          const imgW = imageSettings.width || size * 0.22;
          const imgH = imageSettings.height || size * 0.22;
          const scale = total / size;
          const modW = Math.ceil(imgW * scale);
          const modH = Math.ceil(imgH * scale);
          const center = total / 2;
          excMinX = Math.floor(center - modW / 2);
          excMaxX = Math.ceil(center + modW / 2);
          excMinY = Math.floor(center - modH / 2);
          excMaxY = Math.ceil(center + modH / 2);
        }

        let d = "";
        for (let r = 0; r < mSize; r++) {
          const row = modules[r];
          if (!row) continue;
          for (let c = 0; c < mSize; c++) {
            if (row[c]) {
              const x = c + margin;
              const y = r + margin;
              if (
                excMinX !== -1 &&
                x >= excMinX &&
                x < excMaxX &&
                y >= excMinY &&
                y < excMaxY
              ) {
                continue;
              }
              d += `M${x},${y}h1v1h-1z `;
            }
          }
        }

        return { matrixSize: total, pathData: d };
      } catch {
        return { matrixSize: 0, pathData: "" };
      }
    }, [value, level, includeMargin, marginSize, imageSettings, size]);

    if (!matrixSize || !pathData) {
      return (
        <div className={cn("text-xs text-destructive flex items-center p-2 border border-destructive/30 rounded", className)}>
          Invalid QR code value
        </div>
      );
    }

    const imgWidth = imageSettings?.width || size * 0.22;
    const imgHeight = imageSettings?.height || size * 0.22;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${matrixSize} ${matrixSize}`}
        width={size}
        height={size}
        className={cn("select-none max-w-full h-auto", className)}
        role="img"
        aria-label={`QR Code: ${value}`}
        {...props}
      >
        {bgColor !== "transparent" && (
          <rect x={0} y={0} width={matrixSize} height={matrixSize} fill={bgColor} />
        )}
        <path d={pathData} fill={fgColor} shapeRendering="crispEdges" />
        {imageSettings?.src && (
          <image
            href={imageSettings.src}
            x={(matrixSize - (imgWidth * matrixSize) / size) / 2}
            y={(matrixSize - (imgHeight * matrixSize) / size) / 2}
            width={(imgWidth * matrixSize) / size}
            height={(imgHeight * matrixSize) / size}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
      </svg>
    );
  }
);

QRCode.displayName = "QRCode";
