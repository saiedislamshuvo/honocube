import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@honocube/ui";
import type { Collection } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import { DocumentHeader } from "../views/document-header.js";
import { FormView } from "../views/form-view.js";
import { SidePanel } from "../views/side-panel.js";
import type { CollectionDetailPageProps } from "./types.js";

/**
 * Composite record workspace page composing DocumentHeader, FormView (edit mode),
 * and collaboration SidePanel.
 */
export function CollectionDetailPage<TCollection extends Collection<any>>({
  collection,
  recordId,
  onNavigate,
  onRecordSaved,
  className = "",
}: CollectionDetailPageProps<TCollection>): React.JSX.Element {
  const { data: response, isLoading, error } = useCollectionQuery({
    collection,
    id: recordId,
  });
  const record = response?.data;

  const handleNavigate = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else if (typeof window !== "undefined") {
      window.location.href = href;
    }
  };

  if (isLoading && !record) {
    return (
      <div
        data-testid="detail-loading"
        className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading record details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="detail-error"
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive"
      >
        <p className="font-semibold">Failed to load record #{String(recordId)}</p>
        <p className="mt-1 text-xs opacity-80">{error.message}</p>
      </div>
    );
  }

  // Active record (loaded from API or fallback)
  const currentRecord = (record || { id: recordId }) as any;

  return (
    <div
      data-testid="collection-detail-page"
      className={cn("space-y-6 max-w-7xl mx-auto", className)}
    >
      {/* 1. Prominent Document Header */}
      <DocumentHeader
        collection={collection}
        record={currentRecord}
        onBack={() => handleNavigate(`/${collection.name}`)}
        onAction={(action) => {
          if (action === "duplicate") {
            handleNavigate(`/${collection.name}/new?duplicate=${recordId}`);
          }
        }}
      />

      {/* 2. Main Edit Form and Side Panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full">
          <FormView
            collection={collection}
            id={recordId}
            mode="edit"
            showHeader={false}
            onSuccess={onRecordSaved}
          />
        </div>

        {/* 3. Collaboration Side Panel */}
        {collection.sidePanel?.enabled !== false && (
          <div className="w-full lg:w-80 shrink-0">
            <SidePanel
              collection={collection}
              recordId={recordId}
              className="rounded-lg border border-border bg-card shadow-sm max-w-none h-[600px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
