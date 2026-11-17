export interface Company {
  id: string;
  name: string;
  code?: string;
  parentId?: string | null;
  type?: "holding" | "subsidiary" | "branch" | "franchise";
  currency?: string;
  country?: string;
  logo?: string;
  status?: "active" | "inactive";
}

export interface CompanyTreeNode extends Company {
  children: CompanyTreeNode[];
  depth: number;
}

export interface MasterDataSyncOptions {
  targetTenantIds: string[];
  recordIds?: (string | number)[];
  strategy?: "overwrite" | "skip" | "clone";
  matchField?: string;
}

export interface MasterDataSyncResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  targetTenantIds: string[];
}

/**
 * Builds a nested hierarchical tree structure from a flat list of companies.
 */
export function buildCompanyTree(companies: Company[]): CompanyTreeNode[] {
  const nodeMap = new Map<string, CompanyTreeNode>();

  for (const c of companies) {
    nodeMap.set(c.id, {
      ...c,
      children: [],
      depth: 0,
    });
  }

  const roots: CompanyTreeNode[] = [];

  for (const c of companies) {
    const node = nodeMap.get(c.id)!;
    if (c.parentId && nodeMap.has(c.parentId)) {
      const parent = nodeMap.get(c.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const assignDepth = (nodes: CompanyTreeNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      if (node.children.length > 0) {
        assignDepth(node.children, depth + 1);
      }
    }
  };

  assignDepth(roots, 0);
  return roots;
}

/**
 * Returns all child subsidiary IDs for a given parent company, optionally recursing down the tree.
 */
export function getSubsidiaryIds(
  companyId: string,
  companies: Company[],
  recursive = true
): string[] {
  const result: string[] = [];
  const queue = [companyId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const directChildren = companies.filter((c) => c.parentId === currentId);
    for (const child of directChildren) {
      result.push(child.id);
      if (recursive) {
        queue.push(child.id);
      }
    }
  }

  return result;
}

/**
 * Returns the ancestor path of company IDs from the given company up to the root holding parent.
 */
export function getAncestorCompanyIds(companyId: string, companies: Company[]): string[] {
  const ancestors: string[] = [];
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  let current = companyMap.get(companyId);
  while (current && current.parentId) {
    ancestors.push(current.parentId);
    current = companyMap.get(current.parentId);
  }

  return ancestors;
}

/**
 * Checks whether a company is a descendant (subsidiary/branch) of a specified parent company.
 */
export function isDescendantCompany(
  childId: string,
  parentId: string,
  companies: Company[]
): boolean {
  const ancestors = getAncestorCompanyIds(childId, companies);
  return ancestors.includes(parentId);
}

/**
 * Flattens a company hierarchy tree into a depth-annotated array suitable for select dropdowns.
 */
export function flattenCompanyTree(nodes: CompanyTreeNode[]): CompanyTreeNode[] {
  const flattened: CompanyTreeNode[] = [];

  const traverse = (list: CompanyTreeNode[]) => {
    for (const item of list) {
      flattened.push(item);
      if (item.children.length > 0) {
        traverse(item.children);
      }
    }
  };

  traverse(nodes);
  return flattened;
}
