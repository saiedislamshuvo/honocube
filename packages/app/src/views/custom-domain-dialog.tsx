import * as React from "react";
import { useState } from "react";
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
  Switch,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@honocube/ui";
import {
  isValidDomain,
  formatDomainUrl,
  type CustomDomainDialogProps,
} from "@honocube/core";

export function CustomDomainDialog({
  open,
  onOpenChange,
  existingDomain,
  onSave,
  onVerify,
  isSubmitting = false,
  className = "",
}: CustomDomainDialogProps): React.JSX.Element | null {
  const [domain, setDomain] = useState(existingDomain?.domain || "");
  const [isPrimary, setIsPrimary] = useState(existingDomain?.isPrimary || false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sync state on change
  React.useEffect(() => {
    if (existingDomain) {
      setDomain(existingDomain.domain);
      setIsPrimary(existingDomain.isPrimary);
    } else {
      setDomain("");
      setIsPrimary(false);
    }
    setVerifyMessage(null);
  }, [existingDomain, open]);

  const isValid = isValidDomain(domain);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleVerify = async () => {
    if (!existingDomain?.id) return;
    setIsVerifying(true);
    setVerifyMessage(null);
    try {
      if (onVerify) {
        await onVerify(existingDomain.id);
      }
      setVerifyMessage({
        type: "success",
        text: "Domain verified and SSL certificate successfully provisioned!",
      });
    } catch (err: any) {
      setVerifyMessage({
        type: "error",
        text: err?.message || "DNS verification records not found. Propagation can take several minutes.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    if (onSave) {
      await onSave(domain.trim().toLowerCase(), isPrimary);
    }
    if (!existingDomain) {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  // SSR Fallback
  if (typeof document === "undefined") {
    return (
      <div data-testid="custom-domain-dialog" className="hidden">
        <h2>{existingDomain ? `Domain DNS Configuration: ${existingDomain.domain}` : "Connect Custom Domain"}</h2>
        {existingDomain && (
          <div>
            <span>Required DNS Records</span>
            {existingDomain.dnsRecords.map((r, i) => (
              <div key={i} data-testid={`dns-record-row-${r.type}`}>
                <span>{r.type}</span>
                <span>{r.name}</span>
                <span>{r.value}</span>
              </div>
            ))}
            <button data-testid="verify-dns-btn">Check DNS Propagation</button>
          </div>
        )}
        {!existingDomain && (
          <div>
            <input data-testid="custom-domain-input" defaultValue={domain} />
            <input type="checkbox" data-testid="domain-primary-switch" defaultChecked={isPrimary} />
            <button data-testid="save-domain-btn">Connect Domain</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="custom-domain-dialog"
        className={`sm:max-w-xl max-h-[90vh] overflow-y-auto ${className}`}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Globe className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base">
                {existingDomain ? "Domain DNS Configuration" : "Connect Custom Domain"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {existingDomain
                  ? `Configure DNS records with your registrar for ${existingDomain.domain}.`
                  : "Allow your users to access this workspace through your dedicated branded domain."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Domain Input Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-domain-input"
              className="text-xs font-medium text-foreground block"
            >
              Domain Name *
            </label>
            <div className="relative">
              <Input
                id="custom-domain-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="portal.yourcompany.com"
                disabled={Boolean(existingDomain)}
                data-testid="custom-domain-input"
                className={`text-xs h-9 font-mono ${
                  domain && !isValid ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                required
                autoFocus
              />
            </div>
            {domain && !isValid && (
              <p className="text-[11px] text-destructive">
                Please enter a valid domain (e.g. portal.acme.com or app.acme.co).
              </p>
            )}
          </div>

          {/* Primary Domain Option */}
          <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Set as Primary Domain</span>
              <p className="text-[11px] text-muted-foreground">
                Outgoing notification links and default workspace redirects will use this domain.
              </p>
            </div>
            <Switch
              checked={isPrimary}
              onCheckedChange={setIsPrimary}
              data-testid="domain-primary-switch"
            />
          </div>

          {/* DNS Configuration Records Table (shown if editing or domain created) */}
          {existingDomain && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Required DNS Records
                </span>
                <Badge
                  variant={existingDomain.status === "active" ? "default" : "secondary"}
                  className="text-[10px] capitalize gap-1"
                >
                  {existingDomain.status === "active" ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      Active & Verified
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3 text-amber-500" />
                      Pending Verification
                    </>
                  )}
                </Badge>
              </div>

              <div className="border rounded-md overflow-hidden text-xs">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-16 h-8 text-[11px]">Type</TableHead>
                      <TableHead className="h-8 text-[11px]">Name / Host</TableHead>
                      <TableHead className="h-8 text-[11px]">Value / Target</TableHead>
                      <TableHead className="w-16 h-8 text-[11px] text-right">Copy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingDomain.dnsRecords.map((r, i) => (
                      <TableRow key={i} data-testid={`dns-record-row-${r.type}`}>
                        <TableCell className="font-mono font-bold text-[11px]">
                          {r.type}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] max-w-[140px] truncate" title={r.name}>
                          {r.name}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] max-w-[180px] truncate" title={r.value}>
                          {r.value}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-6 p-0"
                            onClick={() => handleCopy(r.value, `rec_${i}`)}
                            title="Copy Value"
                          >
                            {copiedKey === `rec_${i}` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* SSL Status */}
              <div className="flex items-center justify-between p-2.5 bg-muted/20 border rounded-md text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <span className="font-medium">SSL / TLS Security</span>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {existingDomain.sslStatus}
                </Badge>
              </div>

              {/* Verify Status Message */}
              {verifyMessage && (
                <div
                  className={`p-2.5 rounded-md text-xs border flex items-center gap-2 ${
                    verifyMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}
                >
                  {verifyMessage.type === "success" ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0" />
                  )}
                  <span>{verifyMessage.text}</span>
                </div>
              )}

              {/* Verify Trigger Button */}
              <div className="flex items-center justify-between pt-1">
                <a
                  href={formatDomainUrl(existingDomain.domain)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <span>Test URL</span>
                  <ExternalLink className="size-3" />
                </a>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  data-testid="verify-dns-btn"
                  className="h-8 text-xs gap-1.5"
                >
                  {isVerifying && <Loader2 className="size-3.5 animate-spin" />}
                  Check DNS Propagation
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Close
            </Button>

            {!existingDomain && (
              <Button
                type="submit"
                size="sm"
                disabled={!isValid || isSubmitting}
                data-testid="save-domain-btn"
                className="text-xs h-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Connecting...
                  </>
                ) : (
                  "Connect Domain"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
