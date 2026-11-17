import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  createApp,
  defineApi,
  defineResource,
  createDomainManager,
} from "../../src/index.js";
import { createTestDb, posts } from "../fixtures/db.js";

describe("Custom Domain & Subdomain Routing (Issue #150)", () => {
  describe("createDomainManager Core Primitives", () => {
    it("extracts subdomains correctly from rootDomain and localhost", () => {
      const manager = createDomainManager({
        rootDomain: "honocube.app",
        cnameTarget: "cname.honocube.app",
      });

      expect(manager.extractSubdomain("acme.honocube.app")).toBe("acme");
      expect(manager.extractSubdomain("store.client.honocube.app")).toBe("store.client");
      expect(manager.extractSubdomain("acme.honocube.app:8080")).toBe("acme");
      expect(manager.extractSubdomain("acme.localhost:3000")).toBe("acme");
      expect(manager.extractSubdomain("honocube.app")).toBeNull();
      expect(manager.extractSubdomain("customcorp.com")).toBeNull();
    });

    it("identifies reserved system subdomains", () => {
      const manager = createDomainManager();
      expect(manager.isReservedSubdomain("www")).toBe(true);
      expect(manager.isReservedSubdomain("api")).toBe(true);
      expect(manager.isReservedSubdomain("admin")).toBe(true);
      expect(manager.isReservedSubdomain("dashboard")).toBe(true);
      expect(manager.isReservedSubdomain("acme-store")).toBe(false);
    });

    it("registers custom domains and generates DNS verification instructions", () => {
      const manager = createDomainManager({
        rootDomain: "honocube.app",
        cnameTarget: "cname.honocube.app",
      });

      const mapping = manager.registerDomain({
        tenantId: "tenant_acme",
        domain: "portal.acme.com",
        isPrimary: true,
      });

      expect(mapping.id).toBeDefined();
      expect(mapping.tenantId).toBe("tenant_acme");
      expect(mapping.domain).toBe("portal.acme.com");
      expect(mapping.type).toBe("custom_domain");
      expect(mapping.status).toBe("pending");
      expect(mapping.isPrimary).toBe(true);
      expect(mapping.verificationToken).toContain("honocube-verify-");
      expect(mapping.dnsRecords).toHaveLength(2);

      const cname = mapping.dnsRecords.find((r) => r.type === "CNAME");
      expect(cname?.value).toBe("cname.honocube.app");

      const txt = mapping.dnsRecords.find((r) => r.type === "TXT");
      expect(txt?.name).toBe("_honocube-challenge.portal.acme.com");
      expect(txt?.value).toBe(mapping.verificationToken);
    });

    it("prevents registering reserved subdomains", () => {
      const manager = createDomainManager({
        rootDomain: "honocube.app",
      });

      expect(() =>
        manager.registerDomain({
          tenantId: "tenant_1",
          domain: "api.honocube.app",
          type: "subdomain",
        })
      ).toThrow("Subdomain 'api' is reserved");
    });

    it("verifies domains and updates status and SSL certificates", async () => {
      const manager = createDomainManager();
      const mapping = manager.registerDomain({
        tenantId: "tenant_1",
        domain: "portal.acme.com",
      });

      expect(mapping.status).toBe("pending");

      const result = await manager.verifyDomain(mapping.id);
      expect(result.verified).toBe(true);
      expect(result.mapping.status).toBe("active");
      expect(result.mapping.sslStatus).toBe("active");
      expect(result.mapping.verifiedAt).toBeDefined();
    });

    it("manages primary domain designation per tenant", () => {
      const manager = createDomainManager();
      const dom1 = manager.registerDomain({
        tenantId: "t1",
        domain: "dom1.acme.com",
        isPrimary: true,
      });
      const dom2 = manager.registerDomain({
        tenantId: "t1",
        domain: "dom2.acme.com",
        isPrimary: false,
      });

      expect(manager.getDomain(dom1.id)?.isPrimary).toBe(true);
      expect(manager.getDomain(dom2.id)?.isPrimary).toBe(false);

      manager.setPrimaryDomain("t1", dom2.id);
      expect(manager.getDomain(dom1.id)?.isPrimary).toBe(false);
      expect(manager.getDomain(dom2.id)?.isPrimary).toBe(true);
    });

    it("resolves tenants from request hosts with fallback conventions", async () => {
      const manager = createDomainManager({
        rootDomain: "honocube.app",
      });

      manager.registerDomain({
        tenantId: "tenant_custom",
        domain: "portal.custom.com",
      });
      await manager.verifyDomain("portal.custom.com");

      // 1. Registered custom domain
      const customRes = await manager.resolveTenantFromHost("portal.custom.com");
      expect(customRes.tenantId).toBe("tenant_custom");
      expect(customRes.type).toBe("custom_domain");

      // 2. Subdomain convention fallback (subdomain is tenantId)
      const subRes = await manager.resolveTenantFromHost("acmecorp.honocube.app:3000");
      expect(subRes.tenantId).toBe("acmecorp");
      expect(subRes.type).toBe("subdomain");

      // 3. Root domain (no tenant)
      const rootRes = await manager.resolveTenantFromHost("honocube.app");
      expect(rootRes.tenantId).toBeNull();
      expect(rootRes.type).toBe("root");
    });
  });

  describe("API Endpoints & Tenancy Integration", () => {
    it("handles /domains REST endpoints", async () => {
      const resource = defineResource({
        name: "items",
        table: {} as any,
        validator: z.object({ id: z.number(), name: z.string() }),
        adapter: {
          findMany: vi.fn().mockResolvedValue([]),
        } as any,
      });

      const app = defineApi(
        { items: resource },
        {
          domains: {
            rootDomain: "honocube.app",
          },
        } as any
      );

      // 1. Register domain
      const postRes = await app.request("/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant_xyz",
          domain: "store.xyz.com",
          isPrimary: true,
        }),
      });

      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.data.domain).toBe("store.xyz.com");
      expect(postJson.data.tenantId).toBe("tenant_xyz");
      const domainId = postJson.data.id;

      // 2. List domains
      const listRes = await app.request("/domains?tenantId=tenant_xyz");
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.data).toHaveLength(1);
      expect(listJson.data[0].id).toBe(domainId);

      // 3. Verify domain
      const verifyRes = await app.request(`/domains/${domainId}/verify`, {
        method: "POST",
      });
      expect(verifyRes.status).toBe(200);
      const verifyJson = await verifyRes.json();
      expect(verifyJson.verified).toBe(true);
      expect(verifyJson.data.status).toBe("active");

      // 4. Resolve host
      const resolveRes = await app.request("/domains/resolve?host=store.xyz.com");
      expect(resolveRes.status).toBe(200);
      const resolveJson = await resolveRes.json();
      expect(resolveJson.data.tenantId).toBe("tenant_xyz");

      // 5. Delete domain
      const delRes = await app.request(`/domains/${domainId}`, {
        method: "DELETE",
      });
      expect(delRes.status).toBe(200);
      const delJson = await delRes.json();
      expect(delJson.success).toBe(true);
    });

    it("automatically scopes multi-tenant data queries based on request Host header", async () => {
      const { adapter, db } = await createTestDb();

      // Seed records for tenant_alpha and tenant_beta
      await db.insert(posts).values([
        { id: 1, title: "Alpha Secret Post", tenantId: "tenant_alpha" },
        { id: 2, title: "Beta Public Post", tenantId: "tenant_beta" },
      ]);

      const domainManager = createDomainManager({
        rootDomain: "honocube.app",
      });
      domainManager.registerDomain({
        tenantId: "tenant_alpha",
        domain: "portal.alpha.com",
      });
      await domainManager.verifyDomain("portal.alpha.com");

      const app = createApp({
        adapter,
        domainManager,
        tenancy: {
          field: "tenantId",
          domainManager,
        },
      });

      const postResource = app.defineResource({
        name: "posts",
        table: posts,
        validator: z.object({ id: z.number(), title: z.string() }),
      });

      const api = app.defineApi({ posts: postResource });

      // Query from Host: portal.alpha.com -> should only return tenant_alpha's post
      const resAlpha = await api.request("/posts", {
        headers: {
          Host: "portal.alpha.com",
        },
      });

      expect(resAlpha.status).toBe(200);
      const jsonAlpha = await resAlpha.json();
      expect(jsonAlpha.data).toHaveLength(1);
      expect(jsonAlpha.data[0].title).toBe("Alpha Secret Post");

      // Query from Subdomain: tenant_beta.honocube.app -> should only return tenant_beta's post
      const resBeta = await api.request("/posts", {
        headers: {
          Host: "tenant_beta.honocube.app",
        },
      });

      expect(resBeta.status).toBe(200);
      const jsonBeta = await resBeta.json();
      expect(jsonBeta.data).toHaveLength(1);
      expect(jsonBeta.data[0].title).toBe("Beta Public Post");
    });
  });
});
