import * as React from "react";
import { useState, useMemo } from "react";
import {
  UploadCloud,
  FileArchive,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FolderArchive,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
} from "@honocube/ui";
import {
  extractZipArchive,
  matchMediaToRecords,
  formatFileSize,
  type IngestedMediaEntry,
  type BulkMediaMatchResult,
  type IdentifierPattern,
  type BulkMediaIngestDialogProps,
} from "@honocube/core";

export type BulkMediaStep = "upload" | "configure" | "preview" | "complete";

export function BulkMediaIngestDialog({
  open,
  onOpenChange,
  collectionName = "Records",
  records = [],
  identifierFields = ["sku", "barcode", "slug", "id", "code"],
  mediaFields = ["image", "thumbnail", "avatar", "photo", "images"],
  defaultIdentifierField,
  defaultMediaField,
  onIngest,
  isIngesting = false,
}: BulkMediaIngestDialogProps): React.JSX.Element | null {
  const [step, setStep] = useState<BulkMediaStep>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [zipBytes, setZipBytes] = useState<Uint8Array | null>(null);
  const [mediaEntries, setMediaEntries] = useState<IngestedMediaEntry[]>([]);
  const [isLoadingZip, setIsLoadingZip] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration options
  const [identifierField, setIdentifierField] = useState<string>(
    defaultIdentifierField || identifierFields[0] || "sku"
  );
  const [targetField, setTargetField] = useState<string>(
    defaultMediaField || mediaFields[0] || "image"
  );
  const [pattern, setPattern] = useState<IdentifierPattern>("prefix_delimiter");
  const [delimiter, setDelimiter] = useState<string>("_");
  const [strategy, setStrategy] = useState<"replace" | "append" | "skip">("replace");
  const [previewFilter, setPreviewFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [completedSummary, setCompletedSummary] = useState<{
    matchedCount: number;
    fileCount: number;
  } | null>(null);

  // Re-match media entries against records whenever entries or configuration change
  const matchResult: BulkMediaMatchResult = useMemo(() => {
    if (!mediaEntries.length || !records.length) {
      return {
        matches: [],
        unmatchedFiles: mediaEntries,
        unmatchedRecords: records,
        totalFiles: mediaEntries.length,
        matchedFileCount: 0,
        unmatchedFileCount: mediaEntries.length,
      };
    }
    return matchMediaToRecords(mediaEntries, records, {
      identifierField,
      targetField,
      strategy,
    });
  }, [mediaEntries, records, identifierField, targetField, strategy]);

  // Handle ZIP file selection & extraction
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setIsLoadingZip(true);
    setFileName(selectedFile.name);
    setFileSize(selectedFile.size);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setZipBytes(bytes);

      const extracted = await extractZipArchive(bytes, {
        pattern,
        delimiter,
      });

      if (extracted.length === 0) {
        setError("The selected ZIP archive does not contain any valid media files.");
      } else {
        setMediaEntries(extracted);
        setStep("configure");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to parse ZIP archive.");
    } finally {
      setIsLoadingZip(false);
    }
  };

  // Re-run extraction if filename parsing options change
  const handleUpdateExtractionPattern = async (
    newPattern: IdentifierPattern,
    newDelimiter: string
  ) => {
    setPattern(newPattern);
    setDelimiter(newDelimiter);
    if (!zipBytes) return;

    try {
      const extracted = await extractZipArchive(zipBytes, {
        pattern: newPattern,
        delimiter: newDelimiter,
      });
      setMediaEntries(extracted);
    } catch (err: any) {
      setError(err?.message || "Failed to re-parse archive with new pattern.");
    }
  };

  const handleExecuteIngest = async () => {
    if (!onIngest || matchResult.matches.length === 0) return;

    try {
      await onIngest({
        matches: matchResult.matches,
        strategy,
        targetField,
        identifierField,
      });
      setCompletedSummary({
        matchedCount: matchResult.matches.length,
        fileCount: matchResult.matchedFileCount,
      });
      setStep("complete");
    } catch (err: any) {
      setError(err?.message || "Failed to ingest media files.");
    }
  };

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setFileSize(0);
    setZipBytes(null);
    setMediaEntries([]);
    setError(null);
    setCompletedSummary(null);
  };

  // SSR portal fallback
  if (typeof document === "undefined") {
    if (!open) return null;
    return (
      <div data-testid="bulk-media-ingest-dialog" className="hidden">
        <span>{`Bulk Ingest Media for ${collectionName}`}</span>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetState();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent data-testid="bulk-media-ingest-dialog" className="sm:max-w-[680px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderArchive className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Bulk Ingest Media Archive
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Upload a ZIP archive of images or assets to automatically match and attach to{" "}
                <span className="font-medium text-foreground">{collectionName}</span> records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Upload Archive */}
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 my-2 text-center hover:bg-muted/30 transition-colors">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold mb-1">Select Media ZIP Archive</h4>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Supports .zip archives containing JPEG, PNG, WebP, GIF, SVG, and AVIF images. Files
              will be parsed by identifier.
            </p>
            <label className="cursor-pointer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 pointer-events-none"
                disabled={isLoadingZip}
              >
                {isLoadingZip ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Extracting ZIP...</span>
                  </>
                ) : (
                  <>
                    <FileArchive className="h-4 w-4" />
                    <span>Browse ZIP File</span>
                  </>
                )}
              </Button>
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoadingZip}
                data-testid="zip-file-input"
              />
            </label>
          </div>
        )}

        {/* Step 2: Configure Matching Options */}
        {step === "configure" && (
          <div className="flex flex-col gap-4 py-2 text-sm">
            <div className="flex items-center justify-between rounded-md bg-muted/40 p-3 border text-xs">
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-primary" />
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">({formatFileSize(fileSize)})</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {mediaEntries.length} media files detected
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Record Match Field
                </label>
                <select
                  data-testid="identifier-field-select"
                  value={identifierField}
                  onChange={(e) => setIdentifierField(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {identifierFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Field on {collectionName} to match against filename.
                </p>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Target Media Field
                </label>
                <select
                  data-testid="target-field-select"
                  value={targetField}
                  onChange={(e) => setTargetField(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {mediaFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Field where the image URL or attachment will be saved.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Filename Pattern
                </label>
                <select
                  data-testid="pattern-select"
                  value={pattern}
                  onChange={(e) =>
                    handleUpdateExtractionPattern(e.target.value as IdentifierPattern, delimiter)
                  }
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="prefix_delimiter">Prefix with Delimiter (e.g. SKU_1.jpg)</option>
                  <option value="exact">Exact Filename (e.g. SKU.jpg)</option>
                </select>
              </div>

              {pattern === "prefix_delimiter" ? (
                <div>
                  <label className="font-medium text-foreground block mb-1">
                    Variant Delimiter
                  </label>
                  <input
                    type="text"
                    data-testid="delimiter-input"
                    value={delimiter}
                    maxLength={2}
                    onChange={(e) =>
                      handleUpdateExtractionPattern(pattern, e.target.value || "_")
                    }
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                    placeholder="_"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1 text-xs">
                Conflict Strategy
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "replace", label: "Overwrite", desc: "Replace existing images" },
                  { id: "append", label: "Append", desc: "Add to existing images" },
                  { id: "skip", label: "Skip", desc: "Keep existing images" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStrategy(s.id as any)}
                    className={`rounded-md border p-2 text-left transition-colors cursor-pointer ${
                      strategy === s.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="font-medium text-xs text-foreground">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Match Preview */}
        {step === "preview" && (
          <div className="flex flex-col gap-3 py-1 text-xs">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-md border bg-muted/20 p-2.5 text-center">
                <div className="text-muted-foreground text-[10px]">Total Files</div>
                <div className="text-base font-semibold mt-0.5">{matchResult.totalFiles}</div>
              </div>
              <div className="rounded-md border bg-emerald-500/10 border-emerald-500/20 p-2.5 text-center">
                <div className="text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                  Matched Files
                </div>
                <div className="text-base font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {matchResult.matchedFileCount}
                </div>
              </div>
              <div className="rounded-md border bg-primary/10 border-primary/20 p-2.5 text-center">
                <div className="text-primary text-[10px] font-medium">Matched Records</div>
                <div className="text-base font-semibold text-primary mt-0.5">
                  {matchResult.matches.length}
                </div>
              </div>
              <div className="rounded-md border bg-amber-500/10 border-amber-500/20 p-2.5 text-center">
                <div className="text-amber-700 dark:text-amber-400 text-[10px] font-medium">
                  Unmatched Files
                </div>
                <div className="text-base font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                  {matchResult.unmatchedFileCount}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 border-b pb-1 text-xs">
              <button
                type="button"
                onClick={() => setPreviewFilter("all")}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                  previewFilter === "all"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Files ({matchResult.totalFiles})
              </button>
              <button
                type="button"
                onClick={() => setPreviewFilter("matched")}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                  previewFilter === "matched"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Matched ({matchResult.matchedFileCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewFilter("unmatched")}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                  previewFilter === "unmatched"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unmatched ({matchResult.unmatchedFileCount})
              </button>
            </div>

            {/* Matches List */}
            <div className="max-h-[260px] overflow-y-auto rounded-md border divide-y">
              {matchResult.matches.length === 0 && matchResult.unmatchedFiles.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">No media files found.</div>
              )}

              {/* Matched Records */}
              {(previewFilter === "all" || previewFilter === "matched") &&
                matchResult.matches.map((m) => (
                  <div
                    key={String(m.recordId)}
                    className="flex items-center justify-between p-2 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2.5">
                      {m.previewUrl ? (
                        <img
                          src={m.previewUrl}
                          alt={m.identifier}
                          className="h-9 w-9 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <span>{m.identifier}</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({m.matchedFiles.length} {m.matchedFiles.length === 1 ? "file" : "files"})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {m.record?.name || m.record?.title || `Record #${m.recordId}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      {m.status === "matched" && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          Ready to match
                        </Badge>
                      )}
                      {m.status === "already_has_image" && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          {strategy === "replace" ? "Overwriting image" : "Appending image"}
                        </Badge>
                      )}
                      {m.status === "skipped" && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Skipped
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

              {/* Unmatched Files */}
              {(previewFilter === "all" || previewFilter === "unmatched") &&
                matchResult.unmatchedFiles.map((f, idx) => (
                  <div
                    key={`${f.filename}-${idx}`}
                    className="flex items-center justify-between p-2 hover:bg-muted/30 opacity-75"
                  >
                    <div className="flex items-center gap-2.5">
                      {f.previewUrl ? (
                        <img
                          src={f.previewUrl}
                          alt={f.filename}
                          className="h-9 w-9 rounded object-cover border"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-foreground">{f.filename}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Extracted ID: <span className="font-mono">{f.identifier}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      No matching record
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Step 4: Completion */}
        {step === "complete" && completedSummary && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-semibold mb-1">Ingestion Complete</h4>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Successfully matched and ingested{" "}
              <span className="font-medium text-foreground">
                {completedSummary.fileCount} media files
              </span>{" "}
              across{" "}
              <span className="font-medium text-foreground">
                {completedSummary.matchedCount} {collectionName} records
              </span>
              .
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "configure" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("upload")}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setStep("preview")}
                className="gap-1.5"
              >
                <span>Preview Matches</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("configure")}
                disabled={isIngesting}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Configure</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExecuteIngest}
                disabled={isIngesting || matchResult.matches.length === 0}
                className="gap-1.5"
                data-testid="execute-ingest-button"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Ingesting Media...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Ingest {matchResult.matchedFileCount} Files</span>
                  </>
                )}
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
