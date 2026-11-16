import { describe, it, expect } from "vitest";
import {
  isImpersonating,
  formatImpersonationTitle,
  type ImpersonationSession,
} from "../src/index.js";

describe("Superadmin User & Tenant Impersonation Core Helpers (Issue #146)", () => {
  it("evaluates isImpersonating correctly based on presence and expiration", () => {
    expect(isImpersonating(null)).toBe(false);
    expect(isImpersonating(undefined)).toBe(false);

    const activeSession: ImpersonationSession = {
      id: "imp_123",
      originalUser: { id: "admin_1", name: "Super Admin" },
      targetUser: { id: "usr_42", name: "Jane Employee" },
      targetTenantId: "tenant_alpha",
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    expect(isImpersonating(activeSession)).toBe(true);

    const expiredSession: ImpersonationSession = {
      ...activeSession,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(isImpersonating(expiredSession)).toBe(false);
  });

  it("formats user-friendly title for user and tenant combinations", () => {
    const userAndTenant: ImpersonationSession = {
      id: "imp_1",
      originalUser: { id: "super_1", name: "Root Admin" },
      targetUser: { id: "u_2", name: "Alice Support" },
      targetTenantId: "acme_corp",
      startedAt: new Date().toISOString(),
    };
    expect(formatImpersonationTitle(userAndTenant)).toBe(
      "Alice Support @ Tenant acme_corp"
    );

    const userOnly: ImpersonationSession = {
      id: "imp_2",
      originalUser: { id: "super_1", name: "Root Admin" },
      targetUser: { id: "u_3", name: "Bob Staff" },
      startedAt: new Date().toISOString(),
    };
    expect(formatImpersonationTitle(userOnly)).toBe("User Bob Staff");

    const tenantOnly: ImpersonationSession = {
      id: "imp_3",
      originalUser: { id: "super_1", name: "Root Admin" },
      targetTenantId: "beta_holdings",
      startedAt: new Date().toISOString(),
    };
    expect(formatImpersonationTitle(tenantOnly)).toBe("Tenant beta_holdings");
  });
});
