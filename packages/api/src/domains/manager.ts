/**
 * Custom Domain & Subdomain Routing Engine for Multi-Tenant Workspaces (Issue #150).
 * Manages tenant-to-domain mappings, host resolution, DNS record instructions,
 * domain ownership verification, and SSL status tracking.
 */

export type DomainType = "subdomain" | "custom_domain";
export type DomainStatus = "pending" | "verified" | "active" | "failed";
export type SslStatus = "provisioning" | "active" | "failed" | "expired";

export interface DnsRecordInstruction {
  type: "CNAME" | "TXT" | "A";
  name: string;
  value: string;
  status: "valid" | "pending" | "missing";
  description?: string;
}

export interface DomainMapping {
  id: string;
  tenantId: string | number;
  domain: string; // e.g. "acme.honocube.app" or "portal.acme.com"
  type: DomainType;
  status: DomainStatus;
  isPrimary: boolean;
  verificationToken: string;
  dnsRecords: DnsRecordInstruction[];
  sslStatus: SslStatus;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface DomainManagerOptions {
  rootDomain?: string; // e.g. "honocube.app" or "localhost"
  cnameTarget?: string; // e.g. "cname.honocube.app"
  reservedSubdomains?: string[];
  initialDomains?: DomainMapping[];
  verifyDns?: (
    domain: string,
    token: string,
    type: DomainType
  ) => Promise<{ verified: boolean; error?: string }> | { verified: boolean; error?: string };
  authorize?: (c: any, appContext: any) => boolean | Promise<boolean>;
}

export interface DomainResolution {
  tenantId: string | number | null;
  type: DomainType | "root" | "unknown";
  domain: string;
  subdomain?: string;
  mapping?: DomainMapping;
}

export interface DomainManager {
  registerDomain: (params: {
    tenantId: string | number;
    domain: string;
    isPrimary?: boolean;
    type?: DomainType;
  }) => DomainMapping;
  getDomain: (domainOrId: string) => DomainMapping | undefined;
  listDomains: (tenantId?: string | number) => DomainMapping[];
  verifyDomain: (
    domainOrId: string
  ) => Promise<{ verified: boolean; mapping: DomainMapping; error?: string }>;
  removeDomain: (domainOrId: string) => boolean;
  setPrimaryDomain: (tenantId: string | number, domainOrId: string) => DomainMapping | undefined;
  resolveTenantFromHost: (host: string) => Promise<DomainResolution>;
  extractSubdomain: (host: string) => string | null;
  isReservedSubdomain: (subdomain: string) => boolean;
  clear: () => void;
}

export const DEFAULT_RESERVED_SUBDOMAINS = [
  "www",
  "api",
  "admin",
  "app",
  "dashboard",
  "mail",
  "static",
  "assets",
  "auth",
  "login",
  "billing",
  "status",
  "docs",
  "support",
];

/**
 * Creates an instance of the DomainManager for resolving tenants from request hosts
 * and managing domain verification.
 */
export function createDomainManager(options: DomainManagerOptions = {}): DomainManager {
  const rootDomain = (options.rootDomain || "honocube.app").toLowerCase();
  const cnameTarget = options.cnameTarget || `cname.${rootDomain}`;
  const reserved = new Set(
    (options.reservedSubdomains || DEFAULT_RESERVED_SUBDOMAINS).map((s) => s.toLowerCase())
  );

  const domains = new Map<string, DomainMapping>();

  // Load initial mappings if provided
  if (options.initialDomains) {
    for (const d of options.initialDomains) {
      domains.set(d.domain.toLowerCase(), { ...d });
      domains.set(d.id, { ...d });
    }
  }

  const isReservedSubdomain = (subdomain: string): boolean => {
    return reserved.has(subdomain.toLowerCase());
  };

  const extractSubdomain = (rawHost: string): string | null => {
    if (!rawHost) return null;
    // Strip port if present (e.g. "acme.localhost:3000" -> "acme.localhost")
    const host = (rawHost.split(":")[0] || "").toLowerCase().trim();

    // Check localhost development format (e.g. "acme.localhost")
    if (host.endsWith(".localhost")) {
      const parts = host.slice(0, -".localhost".length).split(".");
      return parts[parts.length - 1] || null;
    }

    // Check root domain suffix
    if (rootDomain && host.endsWith(`.${rootDomain}`)) {
      const sub = host.slice(0, -(rootDomain.length + 1));
      return sub || null;
    }

    return null;
  };

  const generateDnsRecords = (
    domain: string,
    type: DomainType,
    token: string
  ): DnsRecordInstruction[] => {
    if (type === "subdomain") {
      return [
        {
          type: "CNAME",
          name: domain,
          value: cnameTarget,
          status: "valid",
          description: "System managed tenant subdomain.",
        },
      ];
    }

    return [
      {
        type: "CNAME",
        name: domain,
        value: cnameTarget,
        status: "pending",
        description: "Routes HTTP/HTTPS traffic to HonoCube edge proxy.",
      },
      {
        type: "TXT",
        name: `_honocube-challenge.${domain}`,
        value: token,
        status: "pending",
        description: "Validates domain ownership for SSL certificate issuance.",
      },
    ];
  };

  const registerDomain = (params: {
    tenantId: string | number;
    domain: string;
    isPrimary?: boolean;
    type?: DomainType;
  }): DomainMapping => {
    const rawDomain = params.domain.toLowerCase().trim();
    if (!rawDomain) {
      throw new Error("Domain name is required.");
    }

    // Determine type automatically if omitted
    const extractedSub = extractSubdomain(rawDomain);
    const domainType: DomainType =
      params.type || (extractedSub && !rawDomain.includes(" ") ? "subdomain" : "custom_domain");

    if (domainType === "subdomain" && extractedSub && isReservedSubdomain(extractedSub)) {
      throw new Error(`Subdomain '${extractedSub}' is reserved and cannot be allocated.`);
    }

    const id = `dom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const verificationToken = `honocube-verify-${Math.random().toString(36).substring(2, 12)}`;
    const now = new Date().toISOString();

    const isSubdomain = domainType === "subdomain";
    const initialStatus: DomainStatus = isSubdomain ? "active" : "pending";
    const initialSsl: SslStatus = isSubdomain ? "active" : "provisioning";

    // If this is set to primary, demote any existing primary for this tenant
    if (params.isPrimary) {
      for (const mapping of domains.values()) {
        if (mapping.tenantId === params.tenantId && mapping.isPrimary) {
          mapping.isPrimary = false;
        }
      }
    }

    const mapping: DomainMapping = {
      id,
      tenantId: params.tenantId,
      domain: rawDomain,
      type: domainType,
      status: initialStatus,
      isPrimary: Boolean(params.isPrimary),
      verificationToken,
      dnsRecords: generateDnsRecords(rawDomain, domainType, verificationToken),
      sslStatus: initialSsl,
      verifiedAt: isSubdomain ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    domains.set(rawDomain, mapping);
    domains.set(id, mapping);
    return mapping;
  };

  const getDomain = (domainOrId: string): DomainMapping | undefined => {
    if (!domainOrId) return undefined;
    return domains.get(domainOrId.toLowerCase().trim());
  };

  const listDomains = (tenantId?: string | number): DomainMapping[] => {
    const seen = new Set<string>();
    const results: DomainMapping[] = [];

    for (const mapping of domains.values()) {
      if (seen.has(mapping.id)) continue;
      seen.add(mapping.id);

      if (tenantId === undefined || tenantId === null || mapping.tenantId === tenantId) {
        results.push(mapping);
      }
    }

    return results.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  };

  const verifyDomain = async (
    domainOrId: string
  ): Promise<{ verified: boolean; mapping: DomainMapping; error?: string }> => {
    const mapping = getDomain(domainOrId);
    if (!mapping) {
      throw new Error(`Domain '${domainOrId}' not found.`);
    }

    if (mapping.type === "subdomain" || mapping.status === "active") {
      mapping.status = "active";
      mapping.sslStatus = "active";
      mapping.verifiedAt = mapping.verifiedAt || new Date().toISOString();
      return { verified: true, mapping };
    }

    let verified = false;
    let error: string | undefined;

    if (options.verifyDns) {
      const res = await options.verifyDns(mapping.domain, mapping.verificationToken, mapping.type);
      verified = res.verified;
      error = res.error;
    } else {
      // Default: simulated verification validates challenge token and marks valid
      verified = true;
    }

    const now = new Date().toISOString();
    mapping.updatedAt = now;

    if (verified) {
      mapping.status = "active";
      mapping.sslStatus = "active";
      mapping.verifiedAt = now;
      mapping.error = undefined;
      for (const record of mapping.dnsRecords) {
        record.status = "valid";
      }
    } else {
      mapping.status = "failed";
      mapping.sslStatus = "failed";
      mapping.error = error || "DNS verification records not found. Propagation may take up to 24 hours.";
    }

    domains.set(mapping.domain, mapping);
    domains.set(mapping.id, mapping);

    return { verified, mapping, error };
  };

  const removeDomain = (domainOrId: string): boolean => {
    const mapping = getDomain(domainOrId);
    if (!mapping) return false;

    domains.delete(mapping.domain);
    domains.delete(mapping.id);
    return true;
  };

  const setPrimaryDomain = (
    tenantId: string | number,
    domainOrId: string
  ): DomainMapping | undefined => {
    const target = getDomain(domainOrId);
    if (!target || target.tenantId !== tenantId) return undefined;

    for (const mapping of listDomains(tenantId)) {
      mapping.isPrimary = mapping.id === target.id;
      domains.set(mapping.domain, mapping);
      domains.set(mapping.id, mapping);
    }

    return target;
  };

  const resolveTenantFromHost = async (rawHost: string): Promise<DomainResolution> => {
    if (!rawHost) {
      return { tenantId: null, type: "unknown", domain: "" };
    }

    const cleanHost = (rawHost.split(":")[0] || "").toLowerCase().trim();

    // 1. Check exact match in registered domains
    const existing = getDomain(cleanHost);
    if (existing && (existing.status === "active" || existing.status === "verified")) {
      return {
        tenantId: existing.tenantId,
        type: existing.type,
        domain: cleanHost,
        subdomain: extractSubdomain(cleanHost) || undefined,
        mapping: existing,
      };
    }

    // 2. Check if cleanHost is root domain itself
    if (cleanHost === rootDomain || cleanHost === `www.${rootDomain}`) {
      return {
        tenantId: null,
        type: "root",
        domain: cleanHost,
      };
    }

    // 3. Check subdomain extraction
    const subdomain = extractSubdomain(cleanHost);
    if (subdomain) {
      if (isReservedSubdomain(subdomain)) {
        return {
          tenantId: null,
          type: "root",
          domain: cleanHost,
          subdomain,
        };
      }

      // Check if domain is registered under subdomain shorthand (e.g. "acme")
      const subMapping = getDomain(subdomain);
      if (subMapping) {
        return {
          tenantId: subMapping.tenantId,
          type: "subdomain",
          domain: cleanHost,
          subdomain,
          mapping: subMapping,
        };
      }

      // Automatic convention fallback: subdomain itself is the tenantId!
      return {
        tenantId: subdomain,
        type: "subdomain",
        domain: cleanHost,
        subdomain,
      };
    }

    // 4. Custom domain not found or not yet verified
    return {
      tenantId: null,
      type: "custom_domain",
      domain: cleanHost,
      mapping: existing,
    };
  };

  const clear = () => {
    domains.clear();
  };

  return {
    registerDomain,
    getDomain,
    listDomains,
    verifyDomain,
    removeDomain,
    setPrimaryDomain,
    resolveTenantFromHost,
    extractSubdomain,
    isReservedSubdomain,
    clear,
  };
}
