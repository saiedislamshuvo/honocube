/**
 * Transactional Email Templates Engine & Dynamic Token Interpolation.
 * Pure TypeScript implementation for template compilation, token extraction,
 * multi-locale overrides, layouts, loops, and conditional blocks.
 */

export type EmailTemplateCategory =
  | "transactional"
  | "auth"
  | "billing"
  | "marketing"
  | "system";

export interface EmailTokenDefinition {
  token: string;
  label: string;
  category: string;
  sampleValue?: string | number;
  description?: string;
}

export interface EmailTemplateLocaleOverride {
  subject?: string;
  previewText?: string;
  bodyHtml?: string;
  bodyText?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  category: EmailTemplateCategory;
  subject: string;
  previewText?: string;
  bodyHtml: string;
  bodyText?: string;
  locale?: string;
  translations?: Record<string, EmailTemplateLocaleOverride>;
  tokens?: EmailTokenDefinition[];
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  layoutId?: string;
  active: boolean;
  tenantId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface EmailLayout {
  id: string;
  name: string;
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  bodyBackgroundColor?: string;
  contentBackgroundColor?: string;
  headerHtml?: string;
  footerHtml?: string;
  footerText?: string;
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  missingTokens: string[];
}

export interface EmailRenderOptions {
  locale?: string;
  layout?: EmailLayout | null;
  customFormatters?: Record<string, (val: any) => string>;
}

/**
 * Safely resolves nested properties and array indices from objects (e.g. "customer.name" or "items.0.sku").
 */
export function getNestedValue(obj: any, path: string): any {
  if (obj === undefined || obj === null || !path) return undefined;
  if (path === "this") return obj;
  if (path in obj) return obj[path];

  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Extracts all unique dynamic tokens from a template string,
 * ignoring control flow keywords like #if, /if, #each, /each, etc.
 */
export function extractTokens(content: string): string[] {
  if (!content) return [];
  const tokens = new Set<string>();
  const tokenRegex = /\{\{\{?\s*([a-zA-Z0-9_.]+)(?:\s*\|[^}]+)?\s*\}?\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(content)) !== null) {
    const raw = match[1]?.trim();
    if (
      raw &&
      !raw.startsWith("#") &&
      !raw.startsWith("/") &&
      !raw.startsWith("^") &&
      raw !== "else" &&
      raw !== "this"
    ) {
      tokens.add(raw);
    }
  }

  // Also extract conditional and loop paths
  const blockRegex = /\{\{#(?:if|unless|each)\s+([a-zA-Z0-9_.]+)\s*\}\}/g;
  while ((match = blockRegex.exec(content)) !== null) {
    if (match[1]) {
      tokens.add(match[1].trim());
    }
  }

  return Array.from(tokens).sort();
}

/**
 * Validates template syntax for balanced block tags (if, unless, each) and unclosed braces.
 */
export function validateTemplateSyntax(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!content) return { valid: true, errors: [] };

  // Check unclosed braces
  const unclosed = content.match(/\{\{[^}]*$/gm);
  if (unclosed) {
    errors.push("Template has unclosed '{{' placeholder braces.");
  }

  // Check block balance
  const stack: string[] = [];
  const tagRegex = /\{\{(#|\/)(if|unless|each)\s*([^}]*)\}\}/g;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRegex.exec(content)) !== null) {
    const isOpening = tagMatch[1] === "#";
    const tagName = tagMatch[2];
    if (!tagName) continue;

    if (isOpening) {
      stack.push(tagName);
    } else {
      if (stack.length === 0) {
        errors.push(`Unexpected closing block {{/${tagName}}} with no matching opening tag.`);
      } else {
        const last = stack.pop();
        if (last !== tagName) {
          errors.push(`Mismatched closing tag {{/${tagName}}}, expected {{/${last}}}.`);
        }
      }
    }
  }

  while (stack.length > 0) {
    const unclosedTag = stack.pop();
    errors.push(`Unclosed opening block {{#${unclosedTag}}}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Strips HTML tags and decodes entities into clean, readable plain text.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";

  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<(?:br|\/p|\/div|\/tr|\/h[1-6]|\/li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  return text;
}

/**
 * Built-in token pipe formatters (e.g. {{price | currency}} or {{created | date}}).
 */
const DEFAULT_FORMATTERS: Record<string, (val: any, arg?: string) => string> = {
  uppercase: (val) => String(val ?? "").toUpperCase(),
  lowercase: (val) => String(val ?? "").toLowerCase(),
  capitalize: (val) => {
    const s = String(val ?? "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  currency: (val, symbol = "$") => {
    const num = Number(val);
    if (isNaN(num)) return String(val ?? "");
    return `${symbol}${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  },
  date: (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },
  datetime: (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },
  default: (val, fallback = "") => {
    if (val === undefined || val === null || val === "") {
      return fallback.replace(/^['"]|['"]$/g, "");
    }
    return String(val);
  },
};

/**
 * Compiles a template string by interpolating variables, conditionals, and loops.
 */
export function renderEmailContent(
  templateString: string,
  data: Record<string, any> = {},
  customFormatters?: Record<string, (val: any) => string>
): { output: string; missingTokens: string[] } {
  if (!templateString) return { output: "", missingTokens: [] };

  const missingTokens = new Set<string>();
  const allFormatters = { ...DEFAULT_FORMATTERS, ...(customFormatters || {}) };

  // 1. Process #if and #unless blocks (handling optional {{else}})
  let content = templateString;

  // Process nested/sequential conditionals
  const processConditions = (str: string, scopeData: Record<string, any>): string => {
    return str.replace(
      /\{\{#(if|unless)\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/\1\}\}/g,
      (_, type, prop, truthyBranch, falsyBranch = "") => {
        const val = getNestedValue(scopeData, prop);
        const isTruthy = Boolean(
          Array.isArray(val) ? val.length > 0 : val !== undefined && val !== null && val !== false && val !== ""
        );
        const shouldShow = type === "if" ? isTruthy : !isTruthy;
        const branchToRender = shouldShow ? truthyBranch : falsyBranch;
        return processConditions(branchToRender, scopeData);
      }
    );
  };
  content = processConditions(content, data);

  // 2. Process #each loops
  content = content.replace(
    /\{\{#each\s+([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, prop, body) => {
      const items = getNestedValue(data, prop);
      if (!Array.isArray(items) || items.length === 0) {
        return "";
      }

      return items
        .map((item, index) => {
          let itemScope: Record<string, any>;
          if (typeof item === "object" && item !== null) {
            itemScope = { ...data, ...item, this: item, "@index": index, "@first": index === 0, "@last": index === items.length - 1 };
          } else {
            itemScope = { ...data, this: item, item, "@index": index, "@first": index === 0, "@last": index === items.length - 1 };
          }
          // Recursively interpolate loop body
          const renderedLoop = renderEmailContent(body, itemScope, customFormatters);
          for (const m of renderedLoop.missingTokens) {
            missingTokens.add(m);
          }
          return renderedLoop.output;
        })
        .join("");
    }
  );

  // 3. Process variable interpolation with filters: {{path | filter('arg')}} or {{{path}}}
  content = content.replace(
    /\{\{\{?\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*([a-zA-Z0-9_]+)(?:\(([^)]*)\))?)?\s*\}?\}\}/g,
    (_, prop, filterName, filterArg) => {
      const val = getNestedValue(data, prop);

      if (val === undefined || val === null) {
        if (!filterName || filterName !== "default") {
          missingTokens.add(prop);
        }
      }

      if (filterName && allFormatters[filterName]) {
        return allFormatters[filterName](val, filterArg);
      }

      return val !== undefined && val !== null ? String(val) : "";
    }
  );

  return {
    output: content,
    missingTokens: Array.from(missingTokens),
  };
}

/**
 * Wraps email HTML body with responsive table layout, header, brand styling, and footer.
 */
export function wrapInEmailLayout(
  htmlContent: string,
  layout: EmailLayout,
  data: Record<string, any> = {}
): string {
  const companyName = layout.companyName || data.company?.name || "HonoCube";
  const primaryColor = layout.primaryColor || "#3b82f6";
  const bodyBg = layout.bodyBackgroundColor || "#f4f5f7";
  const contentBg = layout.contentBackgroundColor || "#ffffff";
  const logoHtml = layout.logoUrl
    ? `<img src="${layout.logoUrl}" alt="${companyName}" style="max-height: 48px; border: 0; outline: none;" />`
    : `<h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${primaryColor};">${companyName}</h1>`;

  const header =
    layout.headerHtml ||
    `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 0 16px 0; text-align: center;">
      <tr>
        <td align="center">
          ${logoHtml}
        </td>
      </tr>
    </table>
    `;

  const footer =
    layout.footerHtml ||
    `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 16px; text-align: center; color: #6b7280; font-size: 12px; line-height: 1.5;">
      <tr>
        <td align="center">
          <p style="margin: 0 0 8px 0;">${layout.footerText || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}</p>
          ${
            layout.unsubscribeUrl
              ? `<p style="margin: 0;"><a href="${layout.unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe / Notification Preferences</a></p>`
              : ""
          }
        </td>
      </tr>
    </table>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${data.subject || ""}</title>
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: ${bodyBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.6; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    a { color: ${primaryColor}; text-decoration: none; }
    .btn { display: inline-block; padding: 12px 24px; font-weight: 600; color: #ffffff !important; background-color: ${primaryColor}; border-radius: 6px; text-decoration: none; text-align: center; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bodyBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${bodyBg}; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td>
              ${header}
            </td>
          </tr>
          <!-- Body Content Card -->
          <tr>
            <td style="background-color: ${contentBg}; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              ${htmlContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Top-level compiler for an EmailTemplate, handling localization, subject interpolation,
 * layout wrapping, and plain-text fallback generation.
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  data: Record<string, any> = {},
  options: EmailRenderOptions = {}
): RenderedEmail {
  const locale = options.locale || template.locale || "en";
  const override = template.translations?.[locale] || {};

  const rawSubject = override.subject || template.subject || "";
  const rawPreview = override.previewText || template.previewText || "";
  const rawHtml = override.bodyHtml || template.bodyHtml || "";
  const rawText = override.bodyText || template.bodyText;

  const allMissing = new Set<string>();

  // 1. Render Subject
  const renderedSubject = renderEmailContent(rawSubject, data, options.customFormatters);
  for (const m of renderedSubject.missingTokens) allMissing.add(m);

  // 2. Render Preview Text
  const renderedPreview = renderEmailContent(rawPreview, data, options.customFormatters);
  for (const m of renderedPreview.missingTokens) allMissing.add(m);

  // 3. Render HTML Body
  const renderedHtml = renderEmailContent(rawHtml, data, options.customFormatters);
  for (const m of renderedHtml.missingTokens) allMissing.add(m);

  // 4. Wrap with Layout if specified
  let finalHtml = renderedHtml.output;
  if (options.layout) {
    finalHtml = wrapInEmailLayout(finalHtml, options.layout, {
      ...data,
      subject: renderedSubject.output,
    });
  }

  // 5. Plain text version
  let finalText: string;
  if (rawText) {
    const renderedTxt = renderEmailContent(rawText, data, options.customFormatters);
    finalText = renderedTxt.output;
    for (const m of renderedTxt.missingTokens) allMissing.add(m);
  } else {
    finalText = htmlToPlainText(renderedHtml.output);
  }

  return {
    subject: renderedSubject.output,
    previewText: renderedPreview.output,
    html: finalHtml,
    text: finalText,
    senderName: template.senderName,
    senderEmail: template.senderEmail,
    replyTo: template.replyTo,
    missingTokens: Array.from(allMissing),
  };
}

/**
 * Standard enterprise token registry definitions.
 */
export const STANDARD_EMAIL_TOKENS: EmailTokenDefinition[] = [
  // Company
  { token: "company.name", label: "Company Name", category: "Company", sampleValue: "Acme Corp" },
  { token: "company.support_email", label: "Support Email", category: "Company", sampleValue: "support@acme.com" },
  { token: "company.website", label: "Website URL", category: "Company", sampleValue: "https://acme.com" },
  { token: "company.address", label: "Physical Address", category: "Company", sampleValue: "123 Market St, Suite 400" },
  { token: "current_year", label: "Current Year", category: "Company", sampleValue: new Date().getFullYear() },

  // User / Customer
  { token: "user.name", label: "Full Name", category: "User", sampleValue: "Alex Mercer" },
  { token: "user.first_name", label: "First Name", category: "User", sampleValue: "Alex" },
  { token: "user.email", label: "Email Address", category: "User", sampleValue: "alex.mercer@example.com" },
  { token: "user.role", label: "Account Role", category: "User", sampleValue: "Administrator" },

  // Order / Transaction
  { token: "order.id", label: "Order ID", category: "Order", sampleValue: "ORD-9482" },
  { token: "order.total", label: "Order Total", category: "Order", sampleValue: "$149.50" },
  { token: "order.date", label: "Order Date", category: "Order", sampleValue: "Nov 17, 2026" },
  { token: "order.status", label: "Order Status", category: "Order", sampleValue: "Confirmed" },
  { token: "order.tracking_url", label: "Tracking URL", category: "Order", sampleValue: "https://track.example.com/ORD-9482" },

  // Invoice / Billing
  { token: "invoice.id", label: "Invoice Number", category: "Billing", sampleValue: "INV-2026-001" },
  { token: "invoice.amount_due", label: "Amount Due", category: "Billing", sampleValue: "$450.00" },
  { token: "invoice.due_date", label: "Due Date", category: "Billing", sampleValue: "Dec 01, 2026" },
  { token: "invoice.payment_url", label: "Payment Link", category: "Billing", sampleValue: "https://pay.example.com/inv/123" },

  // Auth & Security
  { token: "auth.reset_url", label: "Password Reset URL", category: "Security", sampleValue: "https://app.example.com/reset?token=xyz123" },
  { token: "auth.expires_in", label: "Token Expiry", category: "Security", sampleValue: "60 minutes" },
];

/**
 * Default standard email layout.
 */
export const DEFAULT_EMAIL_LAYOUT: EmailLayout = {
  id: "default_branded_layout",
  name: "Default Branded Layout",
  companyName: "HonoCube",
  primaryColor: "#2563eb",
  bodyBackgroundColor: "#f3f4f6",
  contentBackgroundColor: "#ffffff",
  footerText: `© ${new Date().getFullYear()} HonoCube. Enterprise Application Framework.`,
};

/**
 * Standard default email templates for out-of-the-box system communications.
 */
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome_email",
    name: "Welcome & Onboarding Email",
    description: "Sent to newly registered users with getting started instructions.",
    category: "auth",
    subject: "Welcome to {{company.name}}, {{user.first_name}}!",
    previewText: "Your account is ready. Get started today.",
    bodyHtml: `
      <h2 style="margin-top: 0; color: #111827;">Welcome to {{company.name}}!</h2>
      <p>Hi {{user.name | default('there')}},</p>
      <p>We're thrilled to have you on board. Your account has been provisioned and is ready to use.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="{{company.website | default('https://honocube.com')}}" class="btn">Go to Dashboard</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">If you have any questions, simply reply to this email or contact our support team at <a href="mailto:{{company.support_email}}">{{company.support_email}}</a>.</p>
    `,
    active: true,
  },
  {
    id: "password_reset",
    name: "Password Reset Instructions",
    description: "Sent when a user requests a secure password reset link.",
    category: "auth",
    subject: "Reset your {{company.name}} password",
    previewText: "Follow the link below to set a new password.",
    bodyHtml: `
      <h2 style="margin-top: 0; color: #111827;">Password Reset Request</h2>
      <p>Hello {{user.name | default('User')}},</p>
      <p>We received a request to reset your password for your {{company.name}} account. Click the button below to choose a new password:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="{{auth.reset_url}}" class="btn" style="background-color: #dc2626;">Reset Password</a>
      </div>
      <p style="color: #4b5563; font-size: 13px;">This link will expire in <strong>{{auth.expires_in | default('60 minutes')}}</strong>. If you did not request a password reset, you can safely ignore this email.</p>
    `,
    active: true,
  },
  {
    id: "order_confirmation",
    name: "Order Confirmation & Receipt",
    description: "Sent to customers immediately after a purchase is successfully processed.",
    category: "transactional",
    subject: "Order Confirmed: #{{order.id}} ({{order.total}})",
    previewText: "Thank you for your order! We've received your payment.",
    bodyHtml: `
      <h2 style="margin-top: 0; color: #111827;">Order Confirmation</h2>
      <p>Thank you for shopping with {{company.name}}, {{user.first_name}}!</p>
      <p>We've received your order <strong>#{{order.id}}</strong> on {{order.date}}.</p>

      {{#if order.items}}
      <table width="100%" cellpadding="8" cellspacing="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
        <tr style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
          <td align="left">Item</td>
          <td align="center">Qty</td>
          <td align="right">Price</td>
        </tr>
        {{#each order.items}}
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td>{{name}}</td>
          <td align="center">{{quantity | default('1')}}</td>
          <td align="right">{{price | currency}}</td>
        </tr>
        {{/each}}
      </table>
      {{/if}}

      <div style="text-align: right; margin-bottom: 24px;">
        <p style="font-size: 16px; margin: 4px 0;"><strong>Total Paid:</strong> {{order.total}}</p>
      </div>

      {{#if order.tracking_url}}
      <div style="margin: 24px 0; text-align: center;">
        <a href="{{order.tracking_url}}" class="btn">Track Your Shipment</a>
      </div>
      {{/if}}
    `,
    active: true,
  },
  {
    id: "invoice_receipt",
    name: "Invoice Payment Receipt",
    description: "Sent when an invoice payment is recorded or settled.",
    category: "billing",
    subject: "Invoice Receipt: {{invoice.id}} ({{invoice.amount_due}})",
    previewText: "Your payment receipt for invoice {{invoice.id}}.",
    bodyHtml: `
      <h2 style="margin-top: 0; color: #111827;">Payment Received</h2>
      <p>Dear {{user.name | default('Valued Customer')}},</p>
      <p>Thank you for your payment. This email confirms payment for invoice <strong>{{invoice.id}}</strong>.</p>
      <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Invoice Number:</strong> {{invoice.id}}</p>
        <p style="margin: 4px 0;"><strong>Amount Paid:</strong> {{invoice.amount_due}}</p>
        <p style="margin: 4px 0;"><strong>Due Date:</strong> {{invoice.due_date}}</p>
      </div>
      {{#if invoice.pdf_url}}
      <div style="margin: 24px 0; text-align: center;">
        <a href="{{invoice.pdf_url}}" class="btn">Download PDF Invoice</a>
      </div>
      {{/if}}
    `,
    active: true,
  },
  {
    id: "system_alert",
    name: "System Security Alert",
    description: "Sent for important security alerts or system status events.",
    category: "system",
    subject: "[Security Alert] Important account notification for {{user.email}}",
    previewText: "Security notification regarding your {{company.name}} account.",
    bodyHtml: `
      <h2 style="margin-top: 0; color: #b91c1c;">Security Notice</h2>
      <p>Hello {{user.name | default('User')}},</p>
      <p>We detected an important event on your {{company.name}} account.</p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 18px 0; color: #991b1b;">
        <p style="margin: 0;">{{message | default('A sensitive action was performed on your account.')}}</p>
      </div>
      <p style="font-size: 13px; color: #6b7280;">If this was you, no action is needed. If you did not authorize this, please reset your password immediately or contact <a href="mailto:{{company.support_email}}">{{company.support_email}}</a>.</p>
    `,
    active: true,
  },
];
