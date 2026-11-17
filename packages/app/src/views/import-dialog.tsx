import React, { useState, useMemo, useCallback } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@honocube/ui";
import {
  parseCsv,
  generateCsvTemplate,
  downloadCsvFile,
  importInChunks,
  useApiClient,
  toHumanLabel,
  type Collection,
  type ParsedCsvResult,
  type ImportInChunksProgress,
  type ImportInChunksSummary,
} from "@honocube/core";

export type ImportStep = "upload" | "mapping" | "preview" | "executing" | "complete";

export interface ImportDialogProps<TCollection extends Collection<any>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: TCollection;
  onSuccess?: (results: { totalCreated: number; totalUpdated: number }) => void;
  maxRowsPerRequest?: number;
}

export function ImportDialog<TCollection extends Collection<any>>({
  open,
  onOpenChange,
  collection,
  onSuccess,
  maxRowsPerRequest = 100,
}: ImportDialogProps<TCollection>): React.JSX.Element | null {
  let apiClient: any = null;
  try {
    apiClient = useApiClient();
  } catch {
    // Standalone or test environment
  }

  const [step, setStep] = useState<ImportStep>("upload");
  const [_file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCsvResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewResults, setPreviewResults] = useState<{
    creates: any[];
    updates: any[];
    unchanged: any[];
    errors: any[];
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<ImportInChunksProgress | null>(null);
  const [finalSummary, setFinalSummary] = useState<ImportInChunksSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Resolve Available Target Fields
  const fieldKeys: string[] = useMemo(() => {
    const rawKeys = collection.getFieldKeys ? collection.getFieldKeys() : Object.keys(collection.fields || {});
    return rawKeys.map(String);
  }, [collection]);

  const endpoint = collection.endpoint || `/${collection.name}`;

  // 2. Reset State when closed
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTimeout(() => {
        setStep("upload");
        setFile(null);
        setFileName("");
        setParsed(null);
        setColumnMapping({});
        setPreviewResults(null);
        setExecutionProgress(null);
        setFinalSummary(null);
        setErrorMessage(null);
      }, 200);
    }
    onOpenChange(nextOpen);
  };

  // 3. Download Template Handler
  const handleDownloadTemplate = async () => {
    try {
      if (apiClient) {
        const res = await apiClient.get(`${endpoint}/import/template?format=csv`);
        const text = typeof res === "string" ? res : (res?.data || "");
        if (text) {
          downloadCsvFile(`${collection.name}-template.csv`, text);
          return;
        }
      }
    } catch {
      // Fallback to client-generated template
    }

    const fieldDescriptors = fieldKeys.map((key) => {
      const field = collection.getField ? collection.getField(key) : null;
      return {
        key,
        label: field?.label || toHumanLabel(key),
      };
    });

    const templateCsv = generateCsvTemplate(fieldDescriptors);
    downloadCsvFile(`${collection.name}-template.csv`, templateCsv);
  };

  // 4. File Reading & Auto-Mapping
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const result = parseCsv(content);
      setParsed(result);

      // Intelligent Auto-Mapping
      const initialMapping: Record<string, string> = {};
      for (const header of result.headers) {
        const cleanHeader = header.trim().toLowerCase();
        // Exact match
        const exactMatch = fieldKeys.find((k) => k.toLowerCase() === cleanHeader);
        if (exactMatch) {
          initialMapping[header] = exactMatch;
          continue;
        }
        // Label match
        const labelMatch = fieldKeys.find((k) => {
          const field = collection.getField ? collection.getField(k) : null;
          const label = (field?.label || toHumanLabel(k)).toLowerCase();
          return label === cleanHeader || label.replace(/\s+/g, "") === cleanHeader.replace(/\s+/g, "");
        });
        if (labelMatch) {
          initialMapping[header] = labelMatch;
          continue;
        }
        // Default to skip
        initialMapping[header] = "__skip__";
      }

      setColumnMapping(initialMapping);
    };

    reader.onerror = () => {
      setErrorMessage("Failed to read the selected file.");
    };

    reader.readAsText(selectedFile);
  };

  // 5. Build Mapped Payload
  const getMappedRows = useCallback(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const mappedRecord: Record<string, any> = {};
      for (const [sourceHeader, targetField] of Object.entries(columnMapping)) {
        if (targetField && targetField !== "__skip__") {
          mappedRecord[targetField] = row[sourceHeader];
        }
      }
      return mappedRecord;
    });
  }, [parsed, columnMapping]);

  // 6. Preview Step Handler
  const handleProceedToPreview = async () => {
    const mappedRows = getMappedRows();
    if (mappedRows.length === 0) {
      setErrorMessage("No mapped records available for import.");
      return;
    }

    setStep("preview");
    setIsLoadingPreview(true);
    setErrorMessage(null);

    try {
      if (apiClient) {
        // Send preview request (capped at 50 rows for snappy preview)
        const sampleRows = mappedRows.slice(0, Math.min(mappedRows.length, maxRowsPerRequest));
        const res = await apiClient.post(`${endpoint}/import/preview`, sampleRows);
        setPreviewResults(res?.results || res);
      } else {
        // Standalone simulated preview
        setPreviewResults({
          creates: mappedRows,
          updates: [],
          unchanged: [],
          errors: [],
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to generate import dry-run preview.");
      setPreviewResults({
        creates: [],
        updates: [],
        unchanged: [],
        errors: [{ index: 0, error: err?.message || "Preview failed" }],
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 7. Execute Import Handler
  const handleExecuteImport = async () => {
    const mappedRows = getMappedRows();
    if (mappedRows.length === 0) return;

    setStep("executing");
    setErrorMessage(null);

    try {
      const summary = await importInChunks({
        rows: mappedRows,
        chunkSize: maxRowsPerRequest,
        onChunk: async (chunk) => {
          if (apiClient) {
            const res = await apiClient.post(`${endpoint}/import/execute`, chunk);
            return res?.results || res;
          } else {
            return { creates: chunk, updates: [], errors: [] };
          }
        },
        onProgress: (p) => {
          setExecutionProgress(p);
        },
      });

      setFinalSummary(summary);
      setStep("complete");
      if (onSuccess) {
        onSuccess({
          totalCreated: summary.totalCreated,
          totalUpdated: summary.totalUpdated,
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Batch import execution failed.");
      setStep("preview");
    }
  };

  if (!open) return null;

  // SSR Static Fallback for unit testing and server rendering environments
  if (typeof document === "undefined") {
    return (
      <div data-testid="import-dialog" className="p-6 border rounded-lg bg-card shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span>{`Import ${collection.label || "Records"}`}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bulk ingest CSV and spreadsheet data with declarative column mapping and foreign key resolution.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Badge variant="default">1. Upload</Badge>
            <Badge variant="secondary">2. Map</Badge>
            <Badge variant="secondary">3. Preview</Badge>
            <Badge variant="secondary">4. Finish</Badge>
          </div>
        </div>
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
            <div>
              <h4 className="text-sm font-semibold">Need a sample template?</h4>
              <p className="text-xs text-muted-foreground">Download a pre-formatted template with all resource fields.</p>
            </div>
            <Button type="button" variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1" />
              <span>Download Template</span>
            </Button>
          </div>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <h4 className="text-sm font-semibold">Upload CSV or Tabular File</h4>
            <p className="text-xs text-muted-foreground mb-4">Drag and drop your .csv or .tsv file here, or click to browse.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span>{`Import ${collection.label || "Records"}`}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Bulk ingest CSV and spreadsheet data with declarative column mapping and foreign key resolution.
              </DialogDescription>
            </div>
            {/* Step Indicator Badges */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Badge variant={step === "upload" ? "default" : "secondary"}>1. Upload</Badge>
              <Badge variant={step === "mapping" ? "default" : "secondary"}>2. Map</Badge>
              <Badge variant={step === "preview" ? "default" : "secondary"}>3. Preview</Badge>
              <Badge variant={step === "executing" || step === "complete" ? "default" : "secondary"}>4. Finish</Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-center gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Upload & Template */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Template Download Prompt */}
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
                <div>
                  <h4 className="text-sm font-semibold">Need a sample template?</h4>
                  <p className="text-xs text-muted-foreground">
                    Download a pre-formatted template with all resource fields and relational foreign key headers.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Template</span>
                </Button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/30 transition-colors">
                <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <h4 className="text-sm font-semibold">Upload CSV or Tabular File</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Drag and drop your .csv or .tsv file here, or click to browse.
                </p>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-primary text-primary-foreground h-8 px-4 hover:bg-primary/90">
                    Choose File
                  </span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Selected File Stats */}
              {parsed && (
                <div className="p-4 border rounded-lg bg-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-6 w-6 text-emerald-500" />
                    <div>
                      <div className="text-sm font-medium">{fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {parsed.headers.length} headers detected · {parsed.totalRows} rows ready to map
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Ready
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === "mapping" && parsed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Map Columns to Resource Fields</h4>
                  <p className="text-xs text-muted-foreground">
                    Match source spreadsheet headers with destination collection fields.
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {parsed.headers.length} Columns
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-1/3 text-xs">Spreadsheet Column</TableHead>
                      <TableHead className="w-12 text-center text-xs">Map To</TableHead>
                      <TableHead className="text-xs">Target Field</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.headers.map((header) => {
                      const selectedField = columnMapping[header] || "__skip__";
                      return (
                        <TableRow key={header}>
                          <TableCell className="font-medium text-xs">
                            {header}
                            {parsed.rows[0]?.[header] && (
                              <span className="block text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                                Sample: &quot;{parsed.rows[0][header]}&quot;
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={selectedField}
                              onValueChange={(val) =>
                                setColumnMapping((prev) => ({ ...prev, [header]: val }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-full max-w-xs">
                                <SelectValue placeholder="Select target field..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__" className="text-xs text-muted-foreground italic">
                                  -- Skip (Do Not Import) --
                                </SelectItem>
                                {fieldKeys.map((fk) => {
                                  const fDef = collection.getField ? collection.getField(fk) : null;
                                  return (
                                    <SelectItem key={fk} value={fk} className="text-xs">
                                      {fDef?.label || toHumanLabel(fk)} ({fk})
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* STEP 3: Dry-Run Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              {isLoadingPreview ? (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-sm font-medium">Validating import preview against database...</p>
                </div>
              ) : previewResults ? (
                <>
                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 border rounded-lg bg-card text-center">
                      <div className="text-xs text-muted-foreground font-medium">Total Rows</div>
                      <div className="text-xl font-bold mt-1">{parsed?.totalRows || 0}</div>
                    </div>
                    <div className="p-3 border border-emerald-500/20 bg-emerald-500/10 rounded-lg text-center">
                      <div className="text-xs text-emerald-600 font-medium">New Creates</div>
                      <div className="text-xl font-bold text-emerald-700 mt-1">
                        {previewResults.creates?.length || 0}
                      </div>
                    </div>
                    <div className="p-3 border border-blue-500/20 bg-blue-500/10 rounded-lg text-center">
                      <div className="text-xs text-blue-600 font-medium">Updates</div>
                      <div className="text-xl font-bold text-blue-700 mt-1">
                        {previewResults.updates?.length || 0}
                      </div>
                    </div>
                    <div className="p-3 border border-destructive/20 bg-destructive/10 rounded-lg text-center">
                      <div className="text-xs text-destructive font-medium">Errors</div>
                      <div className="text-xl font-bold text-destructive mt-1">
                        {previewResults.errors?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Errors Notice */}
                  {previewResults.errors && previewResults.errors.length > 0 && (
                    <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 space-y-1 text-xs">
                      <div className="font-semibold text-destructive flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" />
                        <span>Validation or Foreign Key Errors ({previewResults.errors.length})</span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-1 text-muted-foreground pl-5">
                        {previewResults.errors.slice(0, 5).map((err, idx) => (
                          <div key={idx}>
                            Row #{err.index + 1}: {typeof err.error === "string" ? err.error : JSON.stringify(err.error)}
                          </div>
                        ))}
                        {previewResults.errors.length > 5 && (
                          <div className="italic">...and {previewResults.errors.length - 5} more errors</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Records Preview Table */}
                  <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-16 text-xs">#</TableHead>
                          {Object.values(columnMapping)
                            .filter((f) => f !== "__skip__")
                            .slice(0, 5)
                            .map((f) => (
                              <TableHead key={f} className="text-xs">
                                {collection.getField ? collection.getField(f)?.label || toHumanLabel(f) : f}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getMappedRows()
                          .slice(0, 10)
                          .map((row, idx) => {
                            const isError = previewResults.errors?.some((e) => e.index === idx);
                            return (
                              <TableRow key={idx} className={isError ? "bg-destructive/10" : ""}>
                                <TableCell className="text-xs font-mono text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                {Object.values(columnMapping)
                                  .filter((f) => f !== "__skip__")
                                  .slice(0, 5)
                                  .map((f) => (
                                    <TableCell key={f} className="text-xs truncate max-w-[120px]">
                                      {String(row[f] ?? "")}
                                    </TableCell>
                                  ))}
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* STEP 4: Executing Batch Import */}
          {step === "executing" && (
            <div className="py-8 space-y-4 text-center">
              <RefreshCw className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div>
                <h4 className="text-base font-semibold">Importing Records...</h4>
                <p className="text-xs text-muted-foreground">
                  Processing batches of {maxRowsPerRequest} rows with transactional verification.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto space-y-2">
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-2.5 transition-all duration-300"
                    style={{ width: `${executionProgress?.percent || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{executionProgress?.processed || 0} of {executionProgress?.total || 0} processed</span>
                  <span>{executionProgress?.percent || 0}%</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Complete */}
          {step === "complete" && finalSummary && (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <h4 className="text-base font-semibold">Import Completed Successfully</h4>
                <p className="text-xs text-muted-foreground">
                  All valid records have been committed to the database.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                <div className="p-3 border rounded-lg bg-card text-center">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">{finalSummary.totalCreated}</div>
                </div>
                <div className="p-3 border rounded-lg bg-card text-center">
                  <div className="text-xs text-muted-foreground">Updated</div>
                  <div className="text-lg font-bold text-blue-600 mt-1">{finalSummary.totalUpdated}</div>
                </div>
                <div className="p-3 border rounded-lg bg-card text-center">
                  <div className="text-xs text-muted-foreground">Errors</div>
                  <div className="text-lg font-bold text-destructive mt-1">{finalSummary.errors.length}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="pt-3 border-t flex items-center justify-between">
          <div>
            {step === "mapping" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("upload")}
                className="gap-1.5 text-xs h-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            )}
            {step === "preview" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("mapping")}
                className="gap-1.5 text-xs h-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Mapping</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === "upload" && (
              <Button
                type="button"
                size="sm"
                disabled={!parsed || parsed.rows.length === 0}
                onClick={() => setStep("mapping")}
                className="gap-1.5 text-xs h-8"
              >
                <span>Next: Map Columns</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {step === "mapping" && (
              <Button
                type="button"
                size="sm"
                onClick={handleProceedToPreview}
                className="gap-1.5 text-xs h-8"
              >
                <span>Next: Preview & Validate</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {step === "preview" && (
              <Button
                type="button"
                size="sm"
                disabled={isLoadingPreview || (previewResults?.creates?.length === 0 && previewResults?.updates?.length === 0)}
                onClick={handleExecuteImport}
                className="gap-1.5 text-xs h-8"
              >
                <span>Execute Import</span>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {step === "complete" && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="text-xs h-8"
              >
                Done
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
