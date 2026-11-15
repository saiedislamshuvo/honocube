import React from "react";
import {
  Image as ImageIcon,
  X,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  cn,
} from "@honocube/ui";
import { formatFileSize, type MediaAsset } from "@honocube/core";
import { MediaLibraryDialog } from "./media-library.js";

export interface ImagePickerFieldProps {
  id?: string;
  value?: string | string[] | MediaAsset | MediaAsset[] | null;
  onChange: (val: any) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  placeholder?: string;
  assets?: MediaAsset[];
  hasError?: boolean;
  className?: string;
}

function normalizeAsset(item: unknown): MediaAsset {
  if (typeof item === "string") {
    const filename = item.split("/").pop() || item;
    return {
      id: item,
      url: item,
      name: filename,
    };
  }
  if (item && typeof item === "object") {
    const anyItem = item as any;
    return {
      id: anyItem.id || anyItem.url || String(Math.random()),
      url: anyItem.url || "",
      name: anyItem.name || anyItem.url || "Media Asset",
      size: anyItem.size,
      mimeType: anyItem.mimeType,
      width: anyItem.width,
      height: anyItem.height,
      alt: anyItem.alt,
    };
  }
  return { id: "", url: "", name: "" };
}

export function ImagePickerField({
  id,
  value,
  onChange,
  multiple = false,
  accept = "image/*",
  maxSize,
  disabled = false,
  placeholder,
  assets,
  hasError = false,
  className,
}: ImagePickerFieldProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Normalize current items
  const items: MediaAsset[] = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(normalizeAsset).filter((a) => Boolean(a.url));
    }
    const single = normalizeAsset(value);
    return single.url ? [single] : [];
  }, [value]);

  const handleSelectFromLibrary = (selected: MediaAsset[]) => {
    if (multiple) {
      // Determine format matching input (if strings were provided, emit strings; else emit assets)
      const isStringArray = Array.isArray(value) && value.length > 0 && typeof value[0] === "string";
      if (isStringArray) {
        onChange(selected.map((s) => s.url));
      } else {
        onChange(selected);
      }
    } else {
      const first = selected[0];
      if (!first) return;
      if (typeof value === "string") {
        onChange(first.url);
      } else {
        onChange(first);
      }
    }
  };

  const handleRemoveItem = (indexToRemove: number) => {
    if (disabled) return;
    if (multiple) {
      const remaining = items.filter((_, idx) => idx !== indexToRemove);
      const isStringArray = Array.isArray(value) && typeof value[0] === "string";
      onChange(isStringArray ? remaining.map((r) => r.url) : remaining);
    } else {
      onChange(typeof value === "string" ? "" : null);
    }
  };

  const handleDirectFileUpload = (files: FileList | File[]) => {
    if (disabled) return;
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const newAssets: MediaAsset[] = fileList.map((file, idx) => {
      const blobUrl = typeof window !== "undefined" && window.URL?.createObjectURL
        ? window.URL.createObjectURL(file)
        : `blob:${file.name}`;

      return {
        id: `upload-${Date.now()}-${idx}`,
        url: blobUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      };
    });

    if (multiple) {
      const combined = [...items, ...newAssets];
      const isStringArray = Array.isArray(value) && typeof value[0] === "string";
      onChange(isStringArray ? combined.map((c) => c.url) : combined);
    } else {
      const first = newAssets[0];
      if (first) {
        onChange(typeof value === "string" ? first.url : first);
      }
    }
  };

  return (
    <div
      id={id}
      data-testid={id ? `image-picker-${id}` : "image-picker-field"}
      className={cn("flex flex-col gap-2 w-full", className)}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(e) => e.target.files && handleDirectFileUpload(e.target.files)}
        className="hidden"
        data-testid="image-picker-file-input"
      />

      {/* Mode A: Single Asset Picker */}
      {!multiple && (
        <>
          {items.length === 0 ? (
            /* Empty State / Browse Trigger */
            <div
              data-testid="image-picker-empty"
              onDragOver={(e) => {
                if (disabled) return;
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                if (disabled) return;
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer?.files) {
                  handleDirectFileUpload(e.dataTransfer.files);
                }
              }}
              onClick={() => {
                if (!disabled) setIsDialogOpen(true);
              }}
              className={cn(
                "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center bg-muted/15",
                hasError ? "border-destructive" : "border-border hover:border-primary/50",
                isDragging ? "border-primary bg-primary/5" : "",
                disabled ? "opacity-50 cursor-not-allowed" : ""
              )}
            >
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2 text-muted-foreground">
                <ImageIcon className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                {placeholder || "Choose image from library"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                or drag and drop here
              </p>
            </div>
          ) : (
            /* Single Image Preview Card */
            <div
              data-testid="image-picker-preview"
              className={cn(
                "relative flex items-center gap-3 p-2.5 rounded-lg border bg-card text-card-foreground shadow-xs",
                hasError ? "border-destructive" : ""
              )}
            >
              {/* Thumbnail */}
              <div className="relative size-16 rounded-md bg-muted/40 overflow-hidden shrink-0 border">
                <img
                  src={items[0]?.url}
                  alt={items[0]?.name || "Selected image"}
                  className="size-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold truncate text-foreground">
                  {items[0]?.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(items[0]?.size)}
                  {items[0]?.width && items[0]?.height && (
                    <span>{` · ${items[0]?.width}×${items[0]?.height}`}</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  data-testid="image-picker-change-btn"
                  onClick={() => setIsDialogOpen(true)}
                  className="h-8 gap-1 text-xs"
                >
                  <RefreshCw className="size-3" />
                  Change
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  data-testid="image-picker-remove-btn"
                  onClick={() => handleRemoveItem(0)}
                  className="size-8 text-destructive hover:bg-destructive/10"
                  aria-label="Remove image"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Mode B: Multiple Asset Gallery Picker */}
      {multiple && (
        <div data-testid="image-picker-gallery" className="flex flex-col gap-2">
          {items.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{`${items.length} ${items.length === 1 ? "image" : "images"} selected`}</span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="image-picker-clear-all"
                  onClick={() => onChange(Array.isArray(value) && typeof value[0] === "string" ? [] : [])}
                  className="h-6 text-xs px-1 text-muted-foreground hover:text-destructive"
                >
                  Clear all
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {/* Render Gallery Thumbnails */}
            {items.map((asset, index) => (
              <div
                key={asset.id || asset.url || index}
                data-testid={`gallery-item-${index}`}
                className="group relative aspect-square rounded-lg border bg-muted/20 overflow-hidden flex items-center justify-center shadow-xs"
              >
                <img
                  src={asset.url}
                  alt={asset.name || `Gallery image ${index + 1}`}
                  className="size-full object-cover"
                />
                {!disabled && (
                  <button
                    type="button"
                    data-testid={`gallery-remove-${index}`}
                    onClick={() => handleRemoveItem(index)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-background/90 text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground shadow-xs"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
                <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white truncate px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {asset.name}
                </div>
              </div>
            ))}

            {/* "Add Image" Card */}
            {!disabled && (
              <div
                data-testid="gallery-add-card"
                onClick={() => setIsDialogOpen(true)}
                className="aspect-square flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center border-border hover:border-primary/50 bg-muted/10 hover:bg-muted/20 text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-5 mb-1" />
                <span className="text-[11px] font-medium">Add Image</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media Library Dialog */}
      <MediaLibraryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        assets={assets}
        selected={items}
        multiple={multiple}
        accept={accept}
        maxSize={maxSize}
        onConfirm={handleSelectFromLibrary}
      />
    </div>
  );
}
