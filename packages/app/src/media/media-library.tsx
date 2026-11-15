import React from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  FileText,
  Check,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  cn,
} from "@honocube/ui";
import { formatFileSize, type MediaAsset } from "@honocube/core";

export interface MediaLibraryProps {
  /**
   * Managed or initial media assets available in the library.
   */
  assets?: MediaAsset[];
  /**
   * Currently selected asset(s). Can be array of IDs, URLs, or MediaAssets.
   */
  selected?: string | string[] | MediaAsset | MediaAsset[];
  /**
   * Whether multiple assets can be selected concurrently.
   */
  multiple?: boolean;
  /**
   * MIME type filter for uploads and display (e.g. "image/*", "application/pdf").
   */
  accept?: string;
  /**
   * Maximum allowed file size in bytes.
   */
  maxSize?: number;
  /**
   * Callback fired when selection changes.
   */
  onSelect?: (selected: MediaAsset[]) => void;
  /**
   * Callback fired when new files are uploaded.
   */
  onUpload?: (files: File[]) => Promise<MediaAsset[]> | MediaAsset[] | void;
  /**
   * Callback fired when an asset is deleted.
   */
  onDelete?: (asset: MediaAsset) => Promise<void> | void;
  /**
   * Additional container CSS classes.
   */
  className?: string;
}

export function MediaLibrary({
  assets: propAssets,
  selected: propSelected,
  multiple = false,
  accept = "image/*",
  maxSize,
  onSelect,
  onUpload,
  onDelete,
  className,
}: MediaLibraryProps) {
  const [localAssets, setLocalAssets] = React.useState<MediaAsset[]>(() => propAssets || []);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterType, setFilterType] = React.useState<"all" | "images" | "documents">("all");
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Synchronize prop assets when changed externally
  React.useEffect(() => {
    if (propAssets) {
      setLocalAssets(propAssets);
    }
  }, [propAssets]);

  // Normalize selected IDs
  const selectedIds = React.useMemo<string[]>(() => {
    if (!propSelected) return [];
    if (Array.isArray(propSelected)) {
      return propSelected.map((item) =>
        typeof item === "string" ? item : item?.id || item?.url || ""
      ).filter(Boolean);
    }
    if (typeof propSelected === "string") return [propSelected];
    return [propSelected.id || propSelected.url || ""].filter(Boolean);
  }, [propSelected]);

  const [activeSelectedIds, setActiveSelectedIds] = React.useState<string[]>(selectedIds);

  React.useEffect(() => {
    setActiveSelectedIds(selectedIds);
  }, [selectedIds]);

  // Filter assets based on search query and category tab
  const filteredAssets = React.useMemo(() => {
    return localAssets.filter((asset) => {
      const matchesSearch =
        !searchQuery ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.mimeType?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === "images") {
        return asset.mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(asset.url);
      }
      if (filterType === "documents") {
        return !asset.mimeType?.startsWith("image/") && !/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(asset.url);
      }
      return true;
    });
  }, [localAssets, searchQuery, filterType]);

  const handleAssetClick = (asset: MediaAsset) => {
    const assetKey = asset.id || asset.url;
    let nextIds: string[];

    if (multiple) {
      if (activeSelectedIds.includes(assetKey)) {
        nextIds = activeSelectedIds.filter((id) => id !== assetKey);
      } else {
        nextIds = [...activeSelectedIds, assetKey];
      }
    } else {
      nextIds = activeSelectedIds.includes(assetKey) ? [] : [assetKey];
    }

    setActiveSelectedIds(nextIds);

    if (onSelect) {
      const selectedItems = localAssets.filter((a) => nextIds.includes(a.id || a.url));
      onSelect(selectedItems);
    }
  };

  const processUploadedFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (onUpload) {
      const res = await onUpload(fileList);
      if (Array.isArray(res) && res.length > 0) {
        setLocalAssets((prev) => [...res, ...prev]);
        return;
      }
    }

    // Default local file ingestion with object URLs
    const newAssets: MediaAsset[] = fileList.map((file, idx) => {
      const isImg = file.type.startsWith("image/");
      const blobUrl = typeof window !== "undefined" && window.URL?.createObjectURL
        ? window.URL.createObjectURL(file)
        : `blob:${file.name}`;

      return {
        id: `local-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        url: blobUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type || (isImg ? "image/png" : "application/octet-stream"),
        uploadedAt: new Date().toISOString(),
      };
    });

    setLocalAssets((prev) => [...newAssets, ...prev]);

    // Auto-select uploaded assets
    if (!multiple && newAssets[0]) {
      const first = newAssets[0];
      const key = first.id || first.url;
      setActiveSelectedIds([key]);
      onSelect?.([first]);
    } else if (multiple) {
      const newKeys = newAssets.map((a) => a.id || a.url);
      const combined = [...activeSelectedIds, ...newKeys];
      setActiveSelectedIds(combined);
      onSelect?.(localAssets.concat(newAssets).filter((a) => combined.includes(a.id || a.url)));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processUploadedFiles(e.target.files);
    }
  };

  const handleDelete = async (asset: MediaAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    const assetKey = asset.id || asset.url;
    if (onDelete) {
      await onDelete(asset);
    }
    setLocalAssets((prev) => prev.filter((a) => (a.id || a.url) !== assetKey));
    setActiveSelectedIds((prev) => prev.filter((id) => id !== assetKey));
  };

  return (
    <div
      data-testid="media-library"
      className={cn("flex flex-col gap-4 w-full h-full min-h-[400px]", className)}
    >
      {/* 1. Header Toolbar: Search, Category Filters, and Upload Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              data-testid="media-search-input"
              placeholder="Search assets by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Category Tabs */}
          <div className="flex rounded-lg border bg-muted/50 p-0.5 text-xs">
            <button
              type="button"
              data-testid="filter-tab-all"
              onClick={() => setFilterType("all")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                filterType === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              type="button"
              data-testid="filter-tab-images"
              onClick={() => setFilterType("images")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                filterType === "images" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Images
            </button>
            <button
              type="button"
              data-testid="filter-tab-documents"
              onClick={() => setFilterType("documents")}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                filterType === "documents" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Docs
            </button>
          </div>

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="media-file-input"
          />
          <Button
            size="sm"
            data-testid="media-upload-trigger"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 h-9"
          >
            <UploadCloud className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* 2. Drag & Drop Upload Zone */}
      <div
        data-testid="media-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors text-center",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/20"
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground mb-1" />
        <p className="text-xs font-medium text-foreground">
          Drop files to upload, or <span className="text-primary underline">browse</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {accept ? `Supports ${accept}` : "Supports all common media formats"}
          {maxSize ? ` · Max ${formatFileSize(maxSize)}` : ""}
        </p>
      </div>

      {/* 3. Asset Grid View */}
      <div className="flex-1 overflow-y-auto min-h-[250px]">
        {filteredAssets.length === 0 ? (
          <EmptyState
            data-testid="media-empty-state"
            title="No media assets found"
            description={searchQuery ? `No assets matching "${searchQuery}"` : "Upload images or files to build your media library."}
            icon={<ImageIcon className="size-8 text-muted-foreground" />}
            className="py-12"
          />
        ) : (
          <div
            data-testid="media-asset-grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            {filteredAssets.map((asset) => {
              const assetKey = asset.id || asset.url;
              const isSelected = activeSelectedIds.includes(assetKey);
              const isImage =
                asset.mimeType?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(asset.url);

              return (
                <div
                  key={assetKey}
                  data-testid={`media-asset-card-${asset.id || asset.name}`}
                  data-selected={isSelected}
                  onClick={() => handleAssetClick(asset)}
                  className={cn(
                    "group relative flex flex-col rounded-lg border bg-card text-card-foreground overflow-hidden cursor-pointer transition-all hover:shadow-sm",
                    isSelected
                      ? "ring-2 ring-primary border-primary shadow-sm"
                      : "hover:border-primary/50"
                  )}
                >
                  {/* Thumbnail / Preview */}
                  <div className="relative aspect-video w-full bg-muted/30 flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={asset.thumbnailUrl || asset.url}
                        alt={asset.alt || asset.name}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                        <FileText className="size-8" />
                        <span className="text-[10px] uppercase font-mono tracking-wider">
                          {asset.mimeType?.split("/")[1] || "FILE"}
                        </span>
                      </div>
                    )}

                    {/* Selection Checkmark Badge */}
                    {isSelected && (
                      <div
                        data-testid={`asset-selected-badge-${asset.id || asset.name}`}
                        className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
                      >
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Metadata & Actions */}
                  <div className="p-2 flex flex-col gap-0.5 text-left">
                    <p
                      title={asset.name}
                      className="text-xs font-medium truncate text-foreground leading-tight"
                    >
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatFileSize(asset.size)}</span>
                      {asset.width && asset.height && (
                        <span className="font-mono text-[10px]">
                          {`${asset.width}×${asset.height}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Delete Action */}
                  {onDelete && (
                    <button
                      type="button"
                      data-testid={`delete-asset-${asset.id || asset.name}`}
                      onClick={(e) => handleDelete(asset, e)}
                      className="absolute top-1.5 left-1.5 size-6 rounded-md bg-background/90 text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground shadow-xs"
                      aria-label={`Delete ${asset.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Footer Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2.5">
        <span data-testid="media-count-summary">
          {`${filteredAssets.length} ${filteredAssets.length === 1 ? "asset" : "assets"} available`}
        </span>
        {activeSelectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="media-selected-badge">
              {`${activeSelectedIds.length} selected`}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => {
                setActiveSelectedIds([]);
                onSelect?.([]);
              }}
            >
              Deselect All
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface MediaLibraryDialogProps {
  /**
   * Controlled open state.
   */
  open?: boolean;
  /**
   * Open change callback.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Dialog title heading.
   */
  title?: string;
  /**
   * Dialog descriptive subtitle.
   */
  description?: string;
  /**
   * Media assets available in library.
   */
  assets?: MediaAsset[];
  /**
   * Currently selected assets / URLs.
   */
  selected?: string | string[] | MediaAsset | MediaAsset[];
  /**
   * Allow multi-selection.
   */
  multiple?: boolean;
  /**
   * Accepted MIME types.
   */
  accept?: string;
  /**
   * Maximum allowed file size.
   */
  maxSize?: number;
  /**
   * Callback on selection confirmation ("Select" / "Insert").
   */
  onConfirm?: (selected: MediaAsset[]) => void;
  /**
   * Optional upload handler.
   */
  onUpload?: (files: File[]) => Promise<MediaAsset[]> | MediaAsset[] | void;
  /**
   * Optional trigger button or element.
   */
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  title = "Media Library",
  description = "Browse, upload, and select visual assets for your record.",
  assets,
  selected: initialSelected,
  multiple = false,
  accept = "image/*",
  maxSize,
  onConfirm,
  onUpload,
  trigger,
  children,
}: MediaLibraryDialogProps) {
  const [currentSelected, setCurrentSelected] = React.useState<MediaAsset[]>([]);

  const handleConfirm = () => {
    onConfirm?.(currentSelected);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {children}
      <DialogContent
        data-testid="media-library-dialog"
        className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden"
      >
        <DialogHeader className="border-b pb-3">
          <DialogTitle data-testid="media-library-title">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          <MediaLibrary
            assets={assets}
            selected={initialSelected}
            multiple={multiple}
            accept={accept}
            maxSize={maxSize}
            onSelect={setCurrentSelected}
            onUpload={onUpload}
          />
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between w-full">
          <span className="text-xs text-muted-foreground">
            {currentSelected.length === 0
              ? "No assets selected"
              : `${currentSelected.length} ${currentSelected.length === 1 ? "asset" : "assets"} chosen`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="media-dialog-cancel-btn"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-testid="media-dialog-confirm-btn"
              disabled={currentSelected.length === 0}
              onClick={handleConfirm}
            >
              {currentSelected.length > 1
                ? `Insert (${currentSelected.length})`
                : "Insert Asset"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
