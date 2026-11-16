import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  ImpersonationBanner,
  ImpersonationDialog,
  WorkspaceShell,
} from "../src/index.js";
import type { ImpersonationSession } from "@honocube/core";

describe("Superadmin User & Tenant Impersonation UI (Issue #146)", () => {
  const activeSession: ImpersonationSession = {
    id: "imp_99",
    originalUser: {
      id: "admin_root",
      name: "Root Superadmin",
      role: "superadmin",
    },
    targetUser: {
      id: "usr_alice",
      name: "Alice Developer",
      role: "developer",
    },
    targetTenantId: "tenant_globex",
    reason: "Ticket #4041 - Debugging access violation",
    startedAt: new Date().toISOString(),
  };

  it("renders ImpersonationBanner with target info, admin identity, and stop button", () => {
    const nullHtml = renderToString(
      <ImpersonationBanner
        session={null as any}
        onStopImpersonation={vi.fn()}
      />
    );
    expect(nullHtml).toBe("");

    const bannerHtml = renderToString(
      <ImpersonationBanner
        session={activeSession}
        onStopImpersonation={vi.fn()}
      />
    );

    expect(bannerHtml).toContain("data-testid=\"impersonation-banner\"");
    expect(bannerHtml).toContain("Impersonation Active:");
    expect(bannerHtml).toContain("Alice Developer @ Tenant tenant_globex");
    expect(bannerHtml).toContain("Real Admin: Root Superadmin");
    expect(bannerHtml).toContain("Ticket #4041 - Debugging access violation");
    expect(bannerHtml).toContain("data-testid=\"stop-impersonation-button\"");
    expect(bannerHtml).toContain("Exit Impersonation");
  });

  it("renders ImpersonationDialog with tenant/user selectors and audit notice", () => {
    const closedHtml = renderToString(
      <ImpersonationDialog
        open={false}
        onOpenChange={vi.fn()}
        onImpersonate={vi.fn()}
      />
    );
    expect(closedHtml).toBe("");

    const openHtml = renderToString(
      <ImpersonationDialog
        open={true}
        onOpenChange={vi.fn()}
        tenants={[
          { id: "tenant_1", name: "Acme Corp" },
          { id: "tenant_2", name: "Stark Industries" },
        ]}
        users={[
          { id: "u_1", name: "Tony Stark", role: "owner" },
          { id: "u_2", name: "Pepper Potts", role: "admin" },
        ]}
        onImpersonate={vi.fn()}
      />
    );

    expect(openHtml).toContain("data-testid=\"impersonation-dialog\"");
    expect(openHtml).toContain("Impersonate User or Tenant");
    expect(openHtml).toContain("data-testid=\"confirm-impersonation-button\"");
    expect(openHtml).toContain("Start Impersonating");
  });

  it("renders ImpersonationBanner at the top of WorkspaceShell when session is active", () => {
    const mockApp = {
      title: "Enterprise ERP",
      collections: [],
    } as any;

    const html = renderToString(
      <WorkspaceShell
        app={mockApp}
        impersonation={activeSession}
        onStopImpersonation={vi.fn()}
      >
        <div data-testid="page-content">Protected Dashboard Content</div>
      </WorkspaceShell>
    );

    expect(html).toContain("data-testid=\"workspace-shell\"");
    expect(html).toContain("data-testid=\"impersonation-banner\"");
    expect(html).toContain("Alice Developer @ Tenant tenant_globex");
    expect(html).toContain("Real Admin: Root Superadmin");
    expect(html).toContain("Protected Dashboard Content");
  });
});
