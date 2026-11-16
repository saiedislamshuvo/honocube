import React, { useState, useMemo, useCallback, useContext } from "react";
import {
  FolderTree,
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  X,
  ChevronsUpDown,
  ChevronsDownUp,
  Loader2,
} from "lucide-react";
import { Button, Input, Badge } from "@honocube/ui";
import {
  AppContext,
  useCollectionQuery,
  type Collection,
  type InferRecord,
  type TreeNode,
  type TreeViewProps,
} from "@honocube/core";

/**
 * Builds a hierarchical tree structure from a flat array of records.
 * Protects against cyclical references and preserves order.
 */
function buildTreeHierarchy<TRecord extends Record<string, any>>(
  records: TRecord[],
  parentField: string,
  titleField: string,
  labelField?: string,
  descriptionField?: string,
  iconField?: string,
  badgeField?: string,
  orderField?: string
): TreeNode<TRecord>[] {
  const recordsById = new Map<string | number, TRecord>();
  const childrenMap = new Map<string | number | null, TRecord[]>();

  records.forEach((rec, idx) => {
    const id = rec.id ?? `rec-${idx}`;
    recordsById.set(id, rec);
  });

  const roots: TRecord[] = [];
  records.forEach((rec) => {
    const pId = rec[parentField];
    const isRoot =
      pId === null ||
      pId === undefined ||
      pId === "" ||
      !recordsById.has(pId);

    if (isRoot) {
      roots.push(rec);
    } else {
      if (!childrenMap.has(pId)) {
        childrenMap.set(pId, []);
      }
      childrenMap.get(pId)!.push(rec);
    }
  });

  const sortRecords = (list: TRecord[]) => {
    if (orderField) {
      return [...list].sort((a, b) => {
        const orderA = a[orderField] ?? 0;
        const orderB = b[orderField] ?? 0;
        if (orderA !== orderB) return Number(orderA) - Number(orderB);
        const nameA = String(a[titleField] ?? (labelField ? a[labelField] : undefined) ?? a.name ?? a.title ?? a.label ?? a.id ?? "");
        const nameB = String(b[titleField] ?? (labelField ? b[labelField] : undefined) ?? b.name ?? b.title ?? b.label ?? b.id ?? "");
        return nameA.localeCompare(nameB);
      });
    }
    return [...list].sort((a, b) => {
      const nameA = String(a[titleField] ?? (labelField ? a[labelField] : undefined) ?? a.name ?? a.title ?? a.label ?? a.id ?? "");
      const nameB = String(b[titleField] ?? (labelField ? b[labelField] : undefined) ?? b.name ?? b.title ?? b.label ?? b.id ?? "");
      return nameA.localeCompare(nameB);
    });
  };

  const visited = new Set<string | number>();

  const createNode = (rec: TRecord, depth: number): TreeNode<TRecord> => {
    const id = rec.id ?? `rec-${visited.size}`;
    visited.add(id);

    const rawChildren = childrenMap.get(id) || [];
    // Protect against cyclical loops
    const validChildren = rawChildren.filter((c) => !visited.has(c.id));
    const sortedChildren = sortRecords(validChildren);

    const label = String(
      rec[titleField] ??
      (labelField ? rec[labelField] : undefined) ??
      rec.name ??
      rec.title ??
      rec.label ??
      rec.id ??
      ""
    );
    const description = descriptionField && rec[descriptionField] != null ? String(rec[descriptionField]) : undefined;
    const icon = iconField && rec[iconField] != null ? String(rec[iconField]) : undefined;
    const badge = badgeField && rec[badgeField] != null ? String(rec[badgeField]) : undefined;
    const order = orderField && rec[orderField] != null ? Number(rec[orderField]) : undefined;

    const children = sortedChildren.map((child) => createNode(child, depth + 1));

    return {
      id,
      label,
      title: label,
      record: rec,
      parentId: rec[parentField] ?? null,
      depth,
      children,
      hasChildren: children.length > 0,
      description,
      icon,
      badge,
      order,
    };
  };

  const sortedRoots = sortRecords(roots);
  const treeNodes = sortedRoots.map((r) => createNode(r, 0));

  // If any unvisited records exist (e.g., circular parent references), append them as roots
  if (visited.size < records.length) {
    records.forEach((rec) => {
      const id = rec.id;
      if (id && !visited.has(id)) {
        treeNodes.push(createNode(rec, 0));
      }
    });
  }

  return treeNodes;
}

/**
 * Recursively checks if a node is a descendant of a potential ancestor.
 */
function isDescendant(ancestorId: string | number, targetNode: TreeNode<any>): boolean {
  if (targetNode.id === ancestorId) return true;
  for (const child of targetNode.children) {
    if (isDescendant(ancestorId, child)) return true;
  }
  return false;
}

/**
 * Highlights matching substring within a text label.
 */
function renderHighlightedText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <span className="bg-primary/20 text-foreground font-semibold rounded-xs px-0.5">
        {match}
      </span>
      {renderHighlightedText(after, query)}
    </>
  );
}

interface TreeViewContentProps<TCollection extends Collection<any>>
  extends TreeViewProps<TCollection> {
  queryResult?: any;
}

function TreeViewContent<TCollection extends Collection<any>>({
  collection,
  data: propData,
  queryResult,
  parentField: propParentField,
  titleField: propTitleField,
  labelField: propLabelField,
  descriptionField: propDescriptionField,
  iconField: propIconField,
  badgeField: propBadgeField,
  orderField: propOrderField,
  initialExpandedDepth: propInitialExpandedDepth,
  defaultExpandedKeys,
  onNodeClick,
  onNodeExpand,
  onAddChild,
  onReparent,
  searchable = true,
  actions,
  allowDragAndDrop: propAllowDragAndDrop,
  className = "",
  emptyText = "No items found.",
}: TreeViewContentProps<TCollection>): React.JSX.Element {
  const records: InferRecord<TCollection>[] = useMemo(() => {
    if (propData) return propData;
    const data = queryResult?.data?.data;
    return Array.isArray(data) ? (data as InferRecord<TCollection>[]) : [];
  }, [propData, queryResult?.data]);

  const treeConfig = collection.tree;
  const parentField = String(propParentField || treeConfig?.parentField || "parentId");
  const titleField = String(propTitleField || propLabelField || treeConfig?.titleField || treeConfig?.labelField || "name");
  const labelField = propLabelField || treeConfig?.labelField || treeConfig?.titleField;
  const descriptionField = propDescriptionField || treeConfig?.descriptionField;
  const iconField = propIconField || treeConfig?.iconField;
  const badgeField = propBadgeField || treeConfig?.badgeField;
  const orderField = propOrderField || treeConfig?.orderField;
  const initialExpandedDepth = propInitialExpandedDepth ?? treeConfig?.initialExpandedDepth ?? 1;
  const allowDragAndDrop = propAllowDragAndDrop ?? treeConfig?.allowDragAndDrop ?? false;

  // 2. Tree Hierarchy
  const fullTree = useMemo(() => {
    return buildTreeHierarchy(
      records,
      parentField,
      titleField,
      labelField,
      descriptionField,
      iconField,
      badgeField,
      orderField
    );
  }, [
    records,
    parentField,
    titleField,
    labelField,
    descriptionField,
    iconField,
    badgeField,
    orderField,
  ]);

  // 3. Search and Auto-Expansion State
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim().toLowerCase();

  // 4. Manual Expansion State
  const initialExpandedKeys = useMemo(() => {
    if (defaultExpandedKeys) return new Set(defaultExpandedKeys);
    const set = new Set<string | number>();
    const collectInitial = (nodes: TreeNode<InferRecord<TCollection>>[]) => {
      nodes.forEach((n) => {
        if (n.depth < initialExpandedDepth && n.hasChildren) {
          set.add(n.id);
        }
        collectInitial(n.children);
      });
    };
    collectInitial(fullTree);
    return set;
  }, [fullTree, defaultExpandedKeys, initialExpandedDepth]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(initialExpandedKeys);

  // Sync expanded keys if fullTree or initial settings change initially
  React.useEffect(() => {
    if (defaultExpandedKeys) {
      setExpandedKeys(new Set(defaultExpandedKeys));
    }
  }, [defaultExpandedKeys]);

  // 5. Filter Tree based on Search Query
  const { filteredTree, searchAncestors, matchCount } = useMemo(() => {
    if (!trimmedQuery) {
      return { filteredTree: fullTree, searchAncestors: new Set<string | number>(), matchCount: 0 };
    }

    const ancestorsToExpand = new Set<string | number>();
    let count = 0;

    const filterNodes = (
      nodes: TreeNode<InferRecord<TCollection>>[]
    ): TreeNode<InferRecord<TCollection>>[] => {
      const result: TreeNode<InferRecord<TCollection>>[] = [];

      nodes.forEach((node) => {
        const matchesLabel = node.label.toLowerCase().includes(trimmedQuery);
        const matchesDesc = node.description ? node.description.toLowerCase().includes(trimmedQuery) : false;
        const isSelfMatch = matchesLabel || matchesDesc;

        if (isSelfMatch) {
          count++;
        }

        const filteredChildren = filterNodes(node.children);
        const hasMatchingChild = filteredChildren.length > 0;

        if (isSelfMatch || hasMatchingChild) {
          if (hasMatchingChild) {
            ancestorsToExpand.add(node.id);
          }
          result.push({
            ...node,
            children: filteredChildren,
            hasChildren: filteredChildren.length > 0,
          });
        }
      });

      return result;
    };

    const filtered = filterNodes(fullTree);
    return { filteredTree: filtered, searchAncestors: ancestorsToExpand, matchCount: count };
  }, [fullTree, trimmedQuery]);

  // Combined expansion state during search
  const effectiveExpandedKeys = useMemo(() => {
    if (!trimmedQuery) return expandedKeys;
    const combined = new Set(expandedKeys);
    searchAncestors.forEach((id) => combined.add(id));
    return combined;
  }, [expandedKeys, searchAncestors, trimmedQuery]);

  // Expand / Collapse Handlers
  const toggleExpand = useCallback(
    (node: TreeNode<InferRecord<TCollection>>) => {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        const isNowExpanded = !next.has(node.id);
        if (isNowExpanded) {
          next.add(node.id);
        } else {
          next.delete(node.id);
        }
        onNodeExpand?.(node, isNowExpanded);
        return next;
      });
    },
    [onNodeExpand]
  );

  const expandAll = useCallback(() => {
    const all = new Set<string | number>();
    const collectAll = (nodes: TreeNode<InferRecord<TCollection>>[]) => {
      nodes.forEach((n) => {
        if (n.hasChildren) all.add(n.id);
        collectAll(n.children);
      });
    };
    collectAll(fullTree);
    setExpandedKeys(all);
  }, [fullTree]);

  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  // Drag and Drop State
  const [draggedNodeId, setDraggedNodeId] = useState<string | number | null>(null);

  // 6. Node Renderer
  const renderNode = (node: TreeNode<InferRecord<TCollection>>) => {
    const isExpanded = effectiveExpandedKeys.has(node.id);
    const isMatching = trimmedQuery && node.label.toLowerCase().includes(trimmedQuery);

    return (
      <div key={node.id} className="select-none" role="none">
        <div
          role="treeitem"
          aria-expanded={node.hasChildren ? isExpanded : undefined}
          aria-label={node.label}
          draggable={allowDragAndDrop}
          onDragStart={(e) => {
            if (!allowDragAndDrop) return;
            setDraggedNodeId(node.id);
            e.dataTransfer.setData("text/plain", String(node.id));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!allowDragAndDrop || !draggedNodeId || draggedNodeId === node.id) return;
            // Prevent dropping ancestor onto child
            if (isDescendant(draggedNodeId, node)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            if (!allowDragAndDrop || !draggedNodeId || draggedNodeId === node.id) return;
            if (isDescendant(draggedNodeId, node)) return;
            e.preventDefault();
            e.stopPropagation();
            const sourceRecord = records.find((r) => r.id === draggedNodeId);
            if (sourceRecord && onReparent) {
              onReparent(sourceRecord, node.id);
            }
            setDraggedNodeId(null);
          }}
          onClick={() => onNodeClick?.(node.record, node)}
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-md transition-colors cursor-pointer text-sm ${
            isMatching
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted/60 text-foreground"
          }`}
        >
          {/* Left: Expander, Icon, Label, Description */}
          <div className="flex items-center min-w-0 flex-1 mr-2">
            {node.hasChildren ? (
              <button
                type="button"
                aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node);
                }}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted-foreground/15 text-muted-foreground hover:text-foreground mr-1 shrink-0 focus:outline-none"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5 h-5 mr-1 shrink-0" aria-hidden="true" />
            )}

            {node.hasChildren ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 mr-2 text-amber-500 shrink-0" />
              ) : (
                <Folder className="h-4 w-4 mr-2 text-amber-500 shrink-0" />
              )
            ) : (
              <File className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            )}

            <div className="flex items-baseline gap-2 min-w-0 truncate">
              <span className="truncate">{renderHighlightedText(node.label, trimmedQuery)}</span>
              {node.description && (
                <span className="truncate text-xs text-muted-foreground hidden sm:inline">
                  {renderHighlightedText(node.description, trimmedQuery)}
                </span>
              )}
            </div>
          </div>

          {/* Right: Child count, Badge, and Add Child Action */}
          <div className="flex items-center gap-1.5 shrink-0">
            {node.hasChildren && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                {node.children.length}
              </Badge>
            )}

            {node.badge && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                {node.badge}
              </Badge>
            )}

            {onAddChild && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title={`Add child to ${node.label}`}
                aria-label={`Add child to ${node.label}`}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node.record, node);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Nested Children */}
        {node.hasChildren && isExpanded && (
          <div role="group" className="relative">
            {/* Tree hierarchy guide connector line */}
            <div
              className="absolute left-0 top-0 bottom-0 border-l border-border/40 pointer-events-none"
              style={{ left: `${node.depth * 20 + 17}px` }}
            />
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = !propData && Boolean(queryResult?.isLoading) && records.length === 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Tree Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border bg-card">
        {/* Search Input */}
        {searchable && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${collection.label || "items"}...`}
              className="h-8 pl-8 pr-7 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {trimmedQuery && (
            <Badge variant="outline" className="text-xs h-7 px-2 font-normal">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </Badge>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title="Expand All"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Expand All</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title="Collapse All"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collapse All</span>
          </Button>

          {actions && <div className="flex items-center gap-1.5 ml-1">{actions}</div>}
        </div>
      </div>

      {/* 2. Tree Canvas */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-lg bg-card">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading tree hierarchy...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card">
          <FolderTree className="h-8 w-8 mb-2 stroke-1 text-muted-foreground/60" />
          <p className="font-medium text-foreground">{emptyText}</p>
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground border rounded-lg bg-card">
          <p className="text-sm">No items matching &ldquo;{searchQuery}&rdquo;</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="mt-3 text-xs h-7"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <div
          role="tree"
          aria-label={collection.label || "Hierarchical Tree"}
          className="rounded-lg border bg-card p-2 shadow-xs space-y-0.5 divide-y-0 overflow-x-auto"
        >
          {filteredTree.map((rootNode) => renderNode(rootNode))}
        </div>
      )}
    </div>
  );
}

function TreeViewWithQuery<TCollection extends Collection<any>>(
  props: TreeViewProps<TCollection>
): React.JSX.Element {
  const queryResult = useCollectionQuery({
    collection: props.collection,
    params: { limit: 500 },
  });

  return <TreeViewContent {...props} queryResult={queryResult} />;
}

export function TreeView<TCollection extends Collection<any>>(
  props: TreeViewProps<TCollection>
): React.JSX.Element {
  const appContext = useContext(AppContext);

  if (props.data !== undefined || !appContext) {
    return <TreeViewContent {...props} />;
  }

  return <TreeViewWithQuery {...props} />;
}
