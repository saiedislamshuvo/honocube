import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  isValidDomain,
  formatDomainUrl,
  CustomDomainDialog,
  DomainSettingsView,
  type DomainMapping,
} from "../src/index.js";

describe("Custom Domain & Subdomain Routing UI (Issue #150)", () => {
  describe("Domain Utilities", () => {
    it("validates domain names accurately", () => {
      expect(isValidDomain("portal.acme.com")).toBe(true);
      expect(isValidDomain("app.my-startup.io")).toBe(true);
      expect(isValidDomain("store.sub.domain.co.uk")).toBe(true);
      expect(isValidDomain("invalid_domain")).toBe(false);
      expect(isValidDomain("http://acme.com")).toBe(false);
      expect(isValidDomain("")).toBe(false);
    });

    it("formats domain URLs with protocol", () => {
      expect(formatDomainUrl("portal.acme.com")).toBe("https://portal.acme.com");
      expect(formatDomainUrl("https://portal.acme.com")).toBe("https://portal.acme.com");
      expect(formatDomainUrl("portal.acme.com", false)).toBe("http://portal.acme.com");
    });
  });

  describe("CustomDomainDialog Component", () => {
    it("renders new domain connection form in open state", () => {
      const html = renderToString(
        <CustomDomainDialog
          open={true}
          onOpenChange={vi.fn()}
          tenantId="tenant_123"
        />
      );

      expect(html).toContain("data-testid=\"custom-domain-dialog\"");
      expect(html).toContain("Connect Custom Domain");
      expect(html).toContain("data-testid=\"custom-domain-input\"");
      expect(html).toContain("data-testid=\"domain-primary-switch\"");
      expect(html).toContain("data-testid=\"save-domain-btn\"");
      expect(html).toContain("Connect Domain");
    });

    it("renders DNS configuration table for existing domain", () => {
      const sampleDomain: DomainMapping = {
        id: "dom_99",
        tenantId: "tenant_123",
        domain: "portal.acmecorp.com",
        type: "custom_domain",
        status: "pending",
        isPrimary: true,
        verificationToken: "honocube-verify-abc123xyz",
        dnsRecords: [
          {
            type: "CNAME",
            name: "portal.acmecorp.com",
            value: "cname.honocube.app",
            status: "pending",
          },
          {
            type: "TXT",
            name: "_honocube-challenge.portal.acmecorp.com",
            value: "honocube-verify-abc123xyz",
            status: "pending",
          },
        ],
        sslStatus: "provisioning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const html = renderToString(
        <CustomDomainDialog
          open={true}
          onOpenChange={vi.fn()}
          tenantId="tenant_123"
          existingDomain={sampleDomain}
          onVerify={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"custom-domain-dialog\"");
      expect(html).toContain("portal.acmecorp.com");
      expect(html).toContain("Required DNS Records");
      expect(html).toContain("data-testid=\"dns-record-row-CNAME\"");
      expect(html).toContain("data-testid=\"dns-record-row-TXT\"");
      expect(html).toContain("cname.honocube.app");
      expect(html).toContain("honocube-verify-abc123xyz");
      expect(html).toContain("data-testid=\"verify-dns-btn\"");
      expect(html).toContain("Check DNS Propagation");
    });

    it("returns null when open is false", () => {
      const html = renderToString(
        <CustomDomainDialog
          open={false}
          onOpenChange={vi.fn()}
          tenantId="tenant_123"
        />
      );

      expect(html).toBe("");
    });
  });

  describe("DomainSettingsView Component", () => {
    it("renders assigned platform subdomain and custom domains list", () => {
      const domains: DomainMapping[] = [
        {
          id: "dom_1",
          tenantId: "acme",
          domain: "portal.acme.com",
          type: "custom_domain",
          status: "active",
          isPrimary: true,
          verificationToken: "token_1",
          dnsRecords: [],
          sslStatus: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "dom_2",
          tenantId: "acme",
          domain: "store.acme.com",
          type: "custom_domain",
          status: "pending",
          isPrimary: false,
          verificationToken: "token_2",
          dnsRecords: [],
          sslStatus: "provisioning",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const html = renderToString(
        <DomainSettingsView
          tenantId="acme"
          tenantName="Acme Corporation"
          subdomain="acme"
          rootDomain="honocube.app"
          domains={domains}
        />
      );

      expect(html).toContain("data-testid=\"domain-settings-view\"");
      expect(html).toContain("Domain &amp; Routing Settings");
      expect(html).toContain("data-testid=\"subdomain-card\"");
      expect(html).toContain("acme.honocube.app");
      expect(html).toContain("https://acme.honocube.app");

      // Custom domains table
      expect(html).toContain("data-testid=\"custom-domain-row-portal.acme.com\"");
      expect(html).toContain("portal.acme.com");
      expect(html).toContain("Primary");
      expect(html).toContain("Verified");

      expect(html).toContain("data-testid=\"custom-domain-row-store.acme.com\"");
      expect(html).toContain("store.acme.com");
      expect(html).toContain("Pending DNS");
      expect(html).toContain("data-testid=\"set-primary-store.acme.com\"");
    });
  });
});
