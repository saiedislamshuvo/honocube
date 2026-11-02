import React from "react";
import { FileQuestion, Plus } from "lucide-react";
import { Button, cn } from "@honocube/ui";
import type { AppInstance } from "../types/app.js";
import { resolveWorkspaceRoute } from "./resolve-route.js";
import { WorkspaceDashboard } from "./workspace-dashboard.js";
import { CollectionDetailPage } from "./collection-detail-page.js";
import { CollectionMultiView } from "../views/multi-view.js";
import { FormPage } from "../views/form-page.js";
import type { WorkspacePageProps } from "./types.js";

function unwrapValue<T>(val: T | Promise<T> | undefined): T | undefined {
  if (!val) return undefined;
  if (typeof (val as any).then === "function") {
    // If React 19 React.use is available
    const reactAny = React as any;
    if (typeof reactAny.use === "function") {
      return reactAny.use(val);
    }
  }
  return val as T;
}

/**
 * Next.js catch-all route component for `app/(workspace)/[[...slug]]/page.tsx`
 * with automatic route resolution, SSR parameter hydration, and 404 fallbacks.
 */
export function WorkspacePage({
  app: propApp,
  config: aliasConfig,
  params: rawParams,
  searchParams: rawSearchParams,
  dashboard,
  notFoundSlot,
  onNavigate,
  className = "",
}: WorkspacePageProps & { config?: AppInstance }): React.JSX.Element {
  const app = propApp || aliasConfig;
  if (!app) {
    throw new Error("WorkspacePage requires an 'app' instance or 'config' prop.");
  }

  // 1. Resolve Params and SearchParams (supports sync & Next.js 15 async)
  const resolvedParams = unwrapValue(rawParams);
  const _resolvedSearchParams = unwrapValue(rawSearchParams);
  const rawSlug = resolvedParams?.slug;

  // 2. Resolve Active Route
  const route = resolveWorkspaceRoute(app, rawSlug);

  const handleNavigate = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else if (typeof window !== "undefined") {
      window.location.href = href;
    }
  };

  // 3. Render Route Type
  return (
    <div
      data-testid="workspace-page"
      data-route-type={route.type}
      className={cn("w-full h-full", className)}
    >
      {/* Route 1: Home Dashboard */}
      {route.type === "home" && (
        <div data-testid="route-home">
          {dashboard || (
            <WorkspaceDashboard app={app} onNavigate={onNavigate} />
          )}
        </div>
      )}

      {/* Route 2: Collection List / Multi-View */}
      {route.type === "list" && route.collection && (
        <div data-testid="route-list" className="space-y-4 max-w-7xl mx-auto">
          <CollectionMultiView
            collection={route.collection}
            onRecordClick={(rec: any) =>
              handleNavigate(`/${route.collection?.name}/${rec.id}`)
            }
            actions={
              <Button
                asChild
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <a
                  data-testid="collection-create-button"
                  href={`/${route.collection.name}/new`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate(`/${route.collection?.name}/new`);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {`New ${route.collection.singular || route.collection.name}`}
                  </span>
                </a>
              </Button>
            }
          />
        </div>
      )}

      {/* Route 3: Create Record Form */}
      {route.type === "create" && route.collection && (
        <div data-testid="route-create">
          <FormPage
            collection={route.collection}
            mode="create"
            backUrl={`/${route.collection.name}`}
            onBack={() => handleNavigate(`/${route.collection?.name}`)}
            onSuccess={(savedRecord: any) => {
              const id = savedRecord?.id;
              if (id) {
                handleNavigate(`/${route.collection?.name}/${id}`);
              } else {
                handleNavigate(`/${route.collection?.name}`);
              }
            }}
          />
        </div>
      )}

      {/* Route 4: Record Detail & Editing View */}
      {route.type === "detail" && route.collection && route.recordId !== undefined && (
        <div data-testid="route-detail">
          <CollectionDetailPage
            collection={route.collection}
            recordId={route.recordId}
            onNavigate={onNavigate}
            onRecordSaved={() => {
              // Stay on record or notify
            }}
          />
        </div>
      )}

      {/* Route 5: Collection Not Found 404 */}
      {route.type === "not-found" && (
        <div data-testid="route-not-found">
          {notFoundSlot || (
            <div
              data-testid="workspace-not-found-card"
              className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto space-y-4 my-12 rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <FileQuestion className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Collection Not Found
                </h2>
                <p className="text-xs text-muted-foreground">
                  The collection{" "}
                  <code className="font-semibold text-foreground px-1 py-0.5 rounded bg-muted">
                    {`"${route.collectionName}"`}
                  </code>{" "}
                  does not exist in {app.title}.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
              >
                <a
                  data-testid="return-dashboard-button"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate("/");
                  }}
                >
                  Return to Dashboard
                </a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
