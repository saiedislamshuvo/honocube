import * as React from "react";
import { useState } from "react";
import {
  Globe,
  Plus,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Star,
  Settings,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@honocube/ui";
import {
  formatDomainUrl,
  type DomainSettingsViewProps,
  type DomainMapping,
} from "@honocube/core";
import { CustomDomainDialog } from "./custom-domain-dialog.js";

export function DomainSettingsView({
  tenantId,
  tenantName = "Workspace",
  subdomain: explicitSubdomain,
  rootDomain = "honocube.app",
  domains: initialDomains = [],
  onAddDomain,
  onVerifyDomain,
  onSetPrimary,
  onRemoveDomain,
  className = "",
}: DomainSettingsViewProps): React.JSX.Element {
  const [domains, setDomains] = useState<DomainMapping[]>(initialDomains);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainMapping | undefined>(undefined);

  // Sync domains prop
  React.useEffect(() => {
    setDomains(initialDomains);
  }, [initialDomains]);

  const assignedSubdomain = explicitSubdomain || String(tenantId).toLowerCase();
  const fullSubdomainUrl = formatDomainUrl(`${assignedSubdomain}.${rootDomain}`);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleOpenAdd = () => {
    setSelectedDomain(undefined);
    setDialogOpen(true);
  };

  const handleOpenConfig = (domain: DomainMapping) => {
    setSelectedDomain(domain);
    setDialogOpen(true);
  };

  const handleAddDomain = async (domainName: string, isPrimary?: boolean) => {
    if (onAddDomain) {
      await onAddDomain(domainName, isPrimary);
    } else {
      // Local simulated addition
      const newMapping: DomainMapping = {
        id: `dom_${Date.now()}`,
        tenantId,
        domain: domainName,
        type: "custom_domain",
        status: "pending",
        isPrimary: Boolean(isPrimary),
        verificationToken: `honocube-verify-${Math.random().toString(36).substring(2, 8)}`,
        dnsRecords: [
          {
            type: "CNAME",
            name: domainName,
            value: `cname.${rootDomain}`,
            status: "pending",
          },
          {
            type: "TXT",
            name: `_honocube-challenge.${domainName}`,
            value: `honocube-verify-${Math.random().toString(36).substring(2, 8)}`,
            status: "pending",
          },
        ],
        sslStatus: "provisioning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDomains((prev) => [...prev, newMapping]);
      setSelectedDomain(newMapping);
    }
  };

  const handleVerify = async (domainId: string) => {
    if (onVerifyDomain) {
      await onVerifyDomain(domainId);
    }
    setDomains((prev) =>
      prev.map((d) =>
        d.id === domainId
          ? {
              ...d,
              status: "active",
              sslStatus: "active",
              verifiedAt: new Date().toISOString(),
            }
          : d
      )
    );
  };

  const handleSetPrimary = async (domainId: string) => {
    if (onSetPrimary) {
      await onSetPrimary(domainId);
    }
    setDomains((prev) =>
      prev.map((d) => ({
        ...d,
        isPrimary: d.id === domainId,
      }))
    );
  };

  const handleRemove = async (domainId: string) => {
    if (onRemoveDomain) {
      await onRemoveDomain(domainId);
    }
    setDomains((prev) => prev.filter((d) => d.id !== domainId));
  };

  return (
    <div
      data-testid="domain-settings-view"
      className={`space-y-6 max-w-4xl mx-auto p-4 md:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="size-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Domain & Routing Settings
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure dedicated subdomains and white-label custom domains for {tenantName}.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenAdd}
          data-testid="add-domain-trigger-btn"
          className="gap-1.5 text-xs h-9 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          Add Custom Domain
        </Button>
      </div>

      {/* 1. Default Platform Subdomain Card */}
      <Card data-testid="subdomain-card">
        <CardHeader className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assigned Workspace Address
            </span>
            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 gap-1">
              <CheckCircle2 className="size-3" />
              Active
            </Badge>
          </div>
          <CardTitle className="text-sm font-semibold text-foreground">
            {assignedSubdomain}.{rootDomain}
          </CardTitle>
          <CardDescription className="text-xs">
            Your organization's primary default address managed automatically by HonoCube.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <div className="flex items-center gap-2 p-2.5 bg-muted/30 border rounded-md">
            <span className="font-mono text-xs flex-1 truncate text-foreground select-all">
              {fullSubdomainUrl}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(fullSubdomainUrl, "subdomain_url")}
              className="size-7 p-0"
              title="Copy URL"
            >
              {copiedKey === "subdomain_url" ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5 text-muted-foreground" />
              )}
            </Button>

            <a
              href={fullSubdomainUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Open Workspace"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* 2. Custom Domains List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Custom Domains</h2>
          <span className="text-xs text-muted-foreground">
            {domains.length} {domains.length === 1 ? "domain" : "domains"} connected
          </span>
        </div>

        {domains.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent className="space-y-3">
              <Globe className="size-8 text-muted-foreground mx-auto stroke-1" />
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-foreground">No custom domains connected</h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Route your organization workspace through a custom domain such as portal.yourcompany.com.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAdd}
                className="text-xs h-8 gap-1.5"
              >
                <Plus className="size-3.5" />
                Connect Domain
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {domains.map((d) => (
              <Card
                key={d.id}
                data-testid={`custom-domain-row-${d.domain}`}
                className="flex items-center justify-between p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                    <Globe className="size-4" />
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground truncate">
                        {d.domain}
                      </span>
                      {d.isPrimary && (
                        <Badge variant="default" className="text-[10px] gap-1 px-1.5 py-0 h-4">
                          <Star className="size-2.5 fill-current" />
                          Primary
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {/* Status */}
                      {d.status === "active" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Verified
                        </span>
                      ) : d.status === "failed" ? (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          DNS Error
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="size-3" />
                          Pending DNS
                        </span>
                      )}
                      <span>•</span>
                      <span>SSL: {d.sslStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenConfig(d)}
                    data-testid={`config-domain-${d.domain}`}
                    className="h-7 text-xs gap-1 px-2"
                  >
                    <Settings className="size-3" />
                    DNS Setup
                  </Button>

                  {!d.isPrimary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimary(d.id)}
                      data-testid={`set-primary-${d.domain}`}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    >
                      Make Primary
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(d.id)}
                    data-testid={`remove-domain-${d.domain}`}
                    className="size-7 p-0 text-destructive hover:text-destructive"
                    title="Remove Domain"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {dialogOpen && (
        <CustomDomainDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={tenantId}
          existingDomain={selectedDomain}
          onSave={handleAddDomain}
          onVerify={handleVerify}
        />
      )}
    </div>
  );
}
