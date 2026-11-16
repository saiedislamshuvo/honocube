import { describe, it, expect } from "vitest";
import {
  buildCompanyTree,
  getSubsidiaryIds,
  getAncestorCompanyIds,
  isDescendantCompany,
  flattenCompanyTree,
  type Company,
} from "../src/index.js";

describe("Company Hierarchy Engine (Issue #137)", () => {
  const companies: Company[] = [
    { id: "holding", name: "Global Holding Inc", type: "holding", parentId: null },
    { id: "sub-na", name: "North America Corp", type: "subsidiary", parentId: "holding" },
    { id: "sub-eu", name: "Europe Operations Ltd", type: "subsidiary", parentId: "holding" },
    { id: "branch-ny", name: "New York Flagship", type: "branch", parentId: "sub-na" },
    { id: "branch-sf", name: "San Francisco Branch", type: "branch", parentId: "sub-na" },
    { id: "branch-ldn", name: "London HQ", type: "branch", parentId: "sub-eu" },
  ];

  it("builds a nested company hierarchy tree with accurate depths", () => {
    const tree = buildCompanyTree(companies);

    expect(tree).toHaveLength(1); // One holding root
    expect(tree[0].id).toBe("holding");
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toHaveLength(2); // sub-na and sub-eu

    const subNA = tree[0].children.find((c) => c.id === "sub-na")!;
    expect(subNA.depth).toBe(1);
    expect(subNA.children).toHaveLength(2); // branch-ny and branch-sf
    expect(subNA.children[0].depth).toBe(2);
  });

  it("resolves direct and recursive subsidiary IDs", () => {
    // Recursive from holding: all 5 children
    const allSubs = getSubsidiaryIds("holding", companies, true);
    expect(allSubs).toHaveLength(5);
    expect(allSubs).toContain("sub-na");
    expect(allSubs).toContain("branch-ny");
    expect(allSubs).toContain("branch-ldn");

    // Direct only from holding: sub-na and sub-eu
    const directSubs = getSubsidiaryIds("holding", companies, false);
    expect(directSubs).toEqual(["sub-na", "sub-eu"]);

    // From sub-na: branch-ny and branch-sf
    const naBranches = getSubsidiaryIds("sub-na", companies, true);
    expect(naBranches).toEqual(["branch-ny", "branch-sf"]);
  });

  it("resolves ancestor company path up to root holding parent", () => {
    const ancestors = getAncestorCompanyIds("branch-ny", companies);
    expect(ancestors).toEqual(["sub-na", "holding"]);

    const rootAncestors = getAncestorCompanyIds("holding", companies);
    expect(rootAncestors).toEqual([]);
  });

  it("checks descendant company relationships accurately", () => {
    expect(isDescendantCompany("branch-ny", "sub-na", companies)).toBe(true);
    expect(isDescendantCompany("branch-ny", "holding", companies)).toBe(true);
    expect(isDescendantCompany("branch-ny", "sub-eu", companies)).toBe(false);
    expect(isDescendantCompany("sub-eu", "sub-na", companies)).toBe(false);
  });

  it("flattens company tree into a linear depth-annotated array", () => {
    const tree = buildCompanyTree(companies);
    const flattened = flattenCompanyTree(tree);

    expect(flattened).toHaveLength(6);
    expect(flattened[0].id).toBe("holding");
    expect(flattened[0].depth).toBe(0);
    expect(flattened.some((f) => f.id === "branch-ny" && f.depth === 2)).toBe(true);
  });
});
