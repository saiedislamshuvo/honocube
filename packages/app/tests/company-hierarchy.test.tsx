import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  CompanyHierarchyTree,
  MasterDataSyncDialog,
  type Company,
} from "../src/index.js";

describe("Company Hierarchy & Master Data UI (Issue #137)", () => {
  const companies: Company[] = [
    { id: "holding", name: "Global Holding Inc", type: "holding", parentId: null, currency: "USD", country: "US" },
    { id: "sub-na", name: "North America Corp", type: "subsidiary", parentId: "holding", currency: "USD" },
    { id: "sub-eu", name: "Europe Operations Ltd", type: "subsidiary", parentId: "holding", currency: "EUR" },
  ];

  it("renders company hierarchy tree with holding and subsidiary cards", () => {
    const html = renderToString(
      <CompanyHierarchyTree
        companies={companies}
        activeCompanyId="sub-na"
      />
    );

    expect(html).toContain("data-testid=\"company-hierarchy-tree\"");
    expect(html).toContain("Global Holding Inc");
    expect(html).toContain("North America Corp");
    expect(html).toContain("Holding");
    expect(html).toContain("Subsidiary");
    expect(html).toContain("Active");
  });

  it("renders sync downstream action triggers when requested", () => {
    const html = renderToString(
      <CompanyHierarchyTree
        companies={companies}
        activeCompanyId="holding"
        onSyncMasterData={() => {}}
      />
    );

    expect(html).toContain("Sync Downstream");
  });

  it("renders MasterDataSyncDialog safely in SSR and client environments", () => {
    const subsidiaries = [
      { id: "sub-na", name: "North America Corp", type: "subsidiary" as const },
      { id: "sub-eu", name: "Europe Operations Ltd", type: "subsidiary" as const },
    ];

    const html = renderToString(
      <MasterDataSyncDialog
        open={true}
        onOpenChange={() => {}}
        sourceCompany={companies[0]}
        subsidiaries={subsidiaries}
        onSync={() => {}}
        resourceName="Tax Categories"
      />
    );

    expect(html).toContain("data-testid=\"master-data-sync-dialog\"");
    expect(html).toContain("Sync Tax Categories");
  });
});
