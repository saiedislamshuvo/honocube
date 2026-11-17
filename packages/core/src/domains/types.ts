/**
 * Multi-Tenant Domain Routing & Verification Types for HonoCube.
 */

export type {
  DomainType,
  DomainStatus,
  SslStatus,
  DnsRecordInstruction,
  DomainMapping,
  DomainManagerOptions,
  DomainResolution,
  DomainManager,
} from "@honocube/api";

/**
 * Validates domain format (e.g. portal.acme.com or acme.app.com).
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== "string") return false;
  const clean = domain.trim().toLowerCase();
  if (clean.length > 253) return false;
  // Standard domain regex matching alphanumeric subdomains and valid TLD
  const domainPattern = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63}(?<!-))*(\.[a-zA-Z]{2,})$/;
  return domainPattern.test(clean);
}

/**
 * Formats a clean public HTTPS URL from a domain or subdomain.
 */
export function formatDomainUrl(domain: string, ssl: boolean = true): string {
  if (!domain) return "";
  const clean = domain.trim().replace(/^https?:\/\//, "");
  const protocol = ssl ? "https://" : "http://";
  return `${protocol}${clean}`;
}
