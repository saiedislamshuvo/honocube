import React from "react";
import { ArrowRight, Layers, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
} from "@honocube/ui";
import type { WorkspaceDashboardProps } from "./types.js";

/**
 * Default home / dashboard overview rendering collection cards, quick statistics,
 * and entry actions for all registered workspace collections.
 */
export function WorkspaceDashboard({
  app,
  onNavigate,
  className = "",
}: WorkspaceDashboardProps): React.JSX.Element {
  const collections = app.getCollections ? app.getCollections() : app.collections || [];

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  return (
    <div
      data-testid="workspace-dashboard"
      className={cn("space-y-6 max-w-7xl mx-auto", className)}
    >
      {/* 1. Header Banner */}
      <div className="space-y-1.5">
        <h1
          data-testid="dashboard-title"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
        >
          {app.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome to your workspace. Select a collection below to manage records, workflows, and pipelines.
        </p>
      </div>

      {/* 2. Collections Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((col) => {
          const label = col.label || col.name;
          const singular = col.singular || col.label || col.name;
          const fieldCount = Object.keys(col.fields || {}).length;
          const listHref = `/${col.name}`;
          const newHref = `/${col.name}/new`;

          return (
            <Card
              key={col.name}
              data-testid={`dashboard-card-${col.name}`}
              className="flex flex-col justify-between hover:border-primary/50 transition-colors shadow-sm"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-foreground">
                        {label}
                      </CardTitle>
                      {col.group && (
                        <CardDescription className="text-xs">
                          {col.group}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {col.group && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {col.group}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="text-xs text-muted-foreground pb-4">
                <p>
                  Manage {singular.toLowerCase()} records, track lifecycle states,
                  and inspect {fieldCount} schema fields.
                </p>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t border-border pt-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <a
                    data-testid={`card-view-${col.name}`}
                    href={listHref}
                    onClick={(e) => handleLinkClick(listHref, e)}
                  >
                    <span>View Records</span>
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </Button>

                <Button
                  asChild
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <a
                    data-testid={`card-create-${col.name}`}
                    href={newHref}
                    onClick={(e) => handleLinkClick(newHref, e)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New {singular}</span>
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
