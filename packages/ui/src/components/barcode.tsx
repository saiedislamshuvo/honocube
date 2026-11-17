import * as React from "react";
import { cn } from "../lib/utils.js";
import { encodeBarcode, type BarcodeFormat } from "../lib/barcode-encoder.js";

export type { BarcodeFormat };

export interface BarcodeProps extends React.SVGAttributes<SVGSVGElement> {
  value: string;
  format?: BarcodeFormat;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  textMargin?: number;
  background?: string;
  lineColor?: string;
  margin?: number;
  className?: string;
}

export const Barcode = React.forwardRef<SVGSVGElement, BarcodeProps>(
  (
    {
      value,
      format = "code128",
      width = 2,
      height = 70,
      displayValue = true,
      fontSize = 13,
      textMargin = 4,
      background = "transparent",
      lineColor = "currentColor",
      margin = 8,
      className,
      ...props
    },
    ref
  ) => {
    const { modules, text } = React.useMemo(() => {
      try {
        return encodeBarcode(value, format);
      } catch {
        return { modules: [], text: value };
      }
    }, [value, format]);

    if (!modules.length) {
      return (
        <div className={cn("text-xs text-destructive flex items-center p-2 border border-destructive/30 rounded", className)}>
          Invalid barcode value
        </div>
      );
    }

    const barcodeWidth = modules.length * width;
    const totalWidth = barcodeWidth + margin * 2;
    const textHeight = displayValue ? fontSize + textMargin : 0;
    const totalHeight = height + textHeight + margin * 2;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        className={cn("select-none max-w-full h-auto", className)}
        role="img"
        aria-label={`Barcode: ${text}`}
        {...props}
      >
        {background !== "transparent" && (
          <rect x={0} y={0} width={totalWidth} height={totalHeight} fill={background} />
        )}
        <g transform={`translate(${margin}, ${margin})`}>
          {modules.map((isBar, index) =>
            isBar ? (
              <rect
                key={index}
                x={index * width}
                y={0}
                width={width}
                height={height}
                fill={lineColor}
              />
            ) : null
          )}
          {displayValue && text && (
            <text
              x={barcodeWidth / 2}
              y={height + textMargin + fontSize - 2}
              textAnchor="middle"
              fill={lineColor}
              fontFamily="monospace"
              fontSize={fontSize}
              fontWeight="500"
              letterSpacing="1px"
            >
              {text}
            </text>
          )}
        </g>
      </svg>
    );
  }
);

Barcode.displayName = "Barcode";
