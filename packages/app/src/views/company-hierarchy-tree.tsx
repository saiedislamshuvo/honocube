import * as React from "react";
import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  RefreshCw,
  Check,
  Globe,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@honocube/ui";
import {
  buildCompanyTree,
  type Company,
  type CompanyTreeNode,
  type CompanyHierarchyTreeProps,
} from "@honocube/core";

export function CompanyHierarchyTree({
  companies,
  activeCompanyId,
  onSelectCompany,
  onSyncMasterData,
  className = "",
}: CompanyHierarchyTreeProps): React.JSX.Element {
  const tree = React.useMemo(() => buildCompanyTree(companies), [companies]);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getTypeBadge = (type?: Company["type"]) => {
    switch (type) {
      case "holding":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] px-1.5 py-0"
          >
            Holding
          </Badge>
        );
      case "subsidiary":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0"
          >
            Subsidiary
          </Badge>
        );
      case "branch":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0"
          >
            Branch
          </Badge>
        );
      case "franchise":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0"
          >
            Franchise
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderCompanyNode = (node: CompanyTreeNode) => {
    const isCollapsed = Boolean(collapsedNodes[node.id]);
    const hasChildren = node.children.length > 0;
    const isActive = activeCompanyId === node.id;

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          data-testid={`company-node-${node.id}`}
          className={cn(
            "group flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
            isActive
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/60 hover:border-border hover:bg-muted/40",
            node.depth > 0 && "ml-5 mt-1.5"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                title={isCollapsed ? "Expand subsidiaries" : "Collapse subsidiaries"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              {node.type === "holding" ? (
                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-medium text-foreground truncate">{node.name}</span>
                {getTypeBadge(node.type)}
                {isActive && (
                  <Badge
                    variant="default"
                    className="h-4 px-1 text-[10px] font-normal gap-0.5"
                  >
                    <Check className="h-2.5 w-2.5" />
                    Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {node.code && <span>{node.code}</span>}
                {node.currency && (
                  <span className="flex items-center gap-0.5">
                    <span>•</span>
                    <span>{node.currency}</span>
                  </span>
                )}
                {node.country && (
                  <span className="flex items-center gap-0.5">
                    <Globe className="h-2.5 w-2.5 inline" />
                    <span>{node.country}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasChildren && onSyncMasterData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSyncMasterData(node)}
                title="Synchronize master data downstream to subsidiaries"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline">Sync Downstream</span>
              </Button>
            )}

            {!isActive && onSelectCompany && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectCompany(node)}
                className="h-7 px-2.5 text-xs"
              >
                Switch
              </Button>
            )}
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="flex flex-col border-l border-border/40 ml-3 pl-1">
            {node.children.map(renderCompanyNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card data-testid="company-hierarchy-tree" className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Company & Holding Hierarchy</span>
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {companies.length} {companies.length === 1 ? "Company" : "Companies"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 flex flex-col gap-2">
        {tree.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No companies configured.
          </div>
        ) : (
          tree.map(renderCompanyNode)
        )}
      </CardContent>
    </Card>
  );
}
