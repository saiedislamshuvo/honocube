import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  extractTokens,
  validateTemplateSyntax,
  htmlToPlainText,
  renderEmailContent,
  renderEmailTemplate,
  wrapInEmailLayout,
  DEFAULT_EMAIL_LAYOUT,
  DEFAULT_EMAIL_TEMPLATES,
  TokenPicker,
  EmailTemplateEditorDialog,
  EmailTemplatesManager,
  type EmailTemplate,
} from "../src/index.js";

describe("Customizable Transactional Email Templates (Issue #149)", () => {
  describe("Token Extraction & Syntax Validation", () => {
    it("extracts unique dynamic tokens from template strings", () => {
      const template = `
        <h1>Order {{order.id}} for {{user.name | uppercase}}</h1>
        <p>Total: {{order.total | currency}}</p>
        {{#if order.isGift}}
          <p>Gift message for {{recipient.name}}</p>
        {{/if}}
        {{#each order.items}}
          <span>{{name}}: {{price}}</span>
        {{/each}}
      `;

      const tokens = extractTokens(template);
      expect(tokens).toContain("order.id");
      expect(tokens).toContain("user.name");
      expect(tokens).toContain("order.total");
      expect(tokens).toContain("order.isGift");
      expect(tokens).toContain("recipient.name");
      expect(tokens).toContain("order.items");
      expect(tokens).toContain("name");
      expect(tokens).toContain("price");
      expect(tokens).not.toContain("#if");
      expect(tokens).not.toContain("/if");
      expect(tokens).not.toContain("#each");
    });

    it("validates balanced block syntax correctly", () => {
      const valid = "{{#if user.active}}<p>Welcome {{user.name}}</p>{{/if}}";
      expect(validateTemplateSyntax(valid).valid).toBe(true);

      const unclosed = "{{#if user.active}}<p>Welcome</p>";
      const unclosedResult = validateTemplateSyntax(unclosed);
      expect(unclosedResult.valid).toBe(false);
      expect(unclosedResult.errors[0]).toContain("Unclosed opening block {{#if}}");

      const mismatched = "{{#if user.active}}<p>Hello</p>{{/each}}";
      const mismatchedResult = validateTemplateSyntax(mismatched);
      expect(mismatchedResult.valid).toBe(false);
      expect(mismatchedResult.errors[0]).toContain("Mismatched closing tag {{/each}}");
    });

    it("converts HTML markup into clean plain text", () => {
      const html = `
        <h2>Order Confirmation</h2>
        <p>Hi John,<br/>Your order is on the way.</p>
        <p>Visit <a href="https://example.com/orders">your dashboard</a>.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;

      const plain = htmlToPlainText(html);
      expect(plain).toContain("Order Confirmation");
      expect(plain).toContain("Hi John,");
      expect(plain).toContain("your dashboard (https://example.com/orders)");
      expect(plain).toContain("• Item 1");
      expect(plain).not.toContain("<h2>");
      expect(plain).not.toContain("</a>");
    });
  });

  describe("Template Interpolation & Rendering Engine", () => {
    it("renders simple and nested variables", () => {
      const raw = "Hello {{user.first_name}}, your company is {{company.name}}.";
      const data = {
        user: { first_name: "Sarah" },
        company: { name: "Globex" },
      };

      const { output, missingTokens } = renderEmailContent(raw, data);
      expect(output).toBe("Hello Sarah, your company is Globex.");
      expect(missingTokens).toHaveLength(0);
    });

    it("applies pipe formatters (currency, uppercase, default)", () => {
      const raw = `
        User: {{user.name | uppercase}}
        Subtotal: {{order.subtotal | currency}}
        Role: {{user.role | default('Guest')}}
      `;

      const data = {
        user: { name: "alice" },
        order: { subtotal: 89.5 },
      };

      const { output } = renderEmailContent(raw, data);
      expect(output).toContain("User: ALICE");
      expect(output).toContain("Subtotal: $89.50");
      expect(output).toContain("Role: Guest");
    });

    it("evaluates conditional blocks (#if, #unless, else)", () => {
      const raw = `
        {{#if isVip}}
          <span>VIP Member Discount Applied</span>
        {{else}}
          <span>Standard Pricing</span>
        {{/if}}
        {{#unless hasVerifiedEmail}}
          <button>Verify Email</button>
        {{/unless}}
      `;

      const vipResult = renderEmailContent(raw, { isVip: true, hasVerifiedEmail: true });
      expect(vipResult.output).toContain("VIP Member Discount Applied");
      expect(vipResult.output).not.toContain("Standard Pricing");
      expect(vipResult.output).not.toContain("Verify Email");

      const standardResult = renderEmailContent(raw, { isVip: false, hasVerifiedEmail: false });
      expect(standardResult.output).toContain("Standard Pricing");
      expect(standardResult.output).not.toContain("VIP Member Discount Applied");
      expect(standardResult.output).toContain("Verify Email");
    });

    it("renders itemized iteration loops (#each)", () => {
      const raw = `
        <ul>
        {{#each items}}
          <li>{{name}} - {{price | currency}}</li>
        {{/each}}
        </ul>
      `;

      const data = {
        items: [
          { name: "Widget A", price: 15.0 },
          { name: "Widget B", price: 25.5 },
        ],
      };

      const { output } = renderEmailContent(raw, data);
      expect(output).toContain("Widget A - $15.00");
      expect(output).toContain("Widget B - $25.50");
    });

    it("wraps HTML with email layout branding", () => {
      const body = "<p>Your password was changed.</p>";
      const wrapped = wrapInEmailLayout(body, DEFAULT_EMAIL_LAYOUT, { subject: "Security Notice" });

      expect(wrapped).toContain("<!DOCTYPE html>");
      expect(wrapped).toContain("HonoCube");
      expect(wrapped).toContain("<p>Your password was changed.</p>");
      expect(wrapped).toContain("Enterprise Application Framework.");
    });

    it("renders full EmailTemplate with locale overrides and missing token reporting", () => {
      const template: EmailTemplate = {
        id: "invoice_notice",
        name: "Invoice Notice",
        category: "billing",
        subject: "Invoice #{{invoice.id}} for {{user.name}}",
        bodyHtml: "<p>Please pay {{invoice.amount}} by {{invoice.due_date}}.</p>",
        locale: "en",
        translations: {
          es: {
            subject: "Factura #{{invoice.id}} para {{user.name}}",
            bodyHtml: "<p>Por favor pague {{invoice.amount}} antes del {{invoice.due_date}}.</p>",
          },
        },
        active: true,
      };

      const enRendered = renderEmailTemplate(template, {
        invoice: { id: "1001", amount: "$50" },
        user: { name: "Bob" },
      });

      expect(enRendered.subject).toBe("Invoice #1001 for Bob");
      expect(enRendered.html).toContain("Please pay $50");
      expect(enRendered.missingTokens).toContain("invoice.due_date");

      const esRendered = renderEmailTemplate(
        template,
        {
          invoice: { id: "1001", amount: "$50", due_date: "1 de Dic" },
          user: { name: "Bob" },
        },
        { locale: "es" }
      );

      expect(esRendered.subject).toBe("Factura #1001 para Bob");
      expect(esRendered.html).toContain("Por favor pague $50 antes del 1 de Dic.");
      expect(esRendered.missingTokens).toHaveLength(0);
    });

    it("renders built-in default templates correctly", () => {
      const orderTemplate = DEFAULT_EMAIL_TEMPLATES.find((t) => t.id === "order_confirmation");
      expect(orderTemplate).toBeDefined();

      const rendered = renderEmailTemplate(orderTemplate!, {
        company: { name: "HonoStore" },
        user: { first_name: "Mark", name: "Mark Davis" },
        order: {
          id: "9988",
          total: "$150.00",
          date: "Nov 17, 2026",
          items: [{ name: "Gadget", quantity: 2, price: 75.0 }],
        },
      });

      expect(rendered.subject).toContain("Order Confirmed: #9988");
      expect(rendered.html).toContain("Thank you for shopping with HonoStore, Mark!");
      expect(rendered.html).toContain("Gadget");
      expect(rendered.html).toContain("$75.00");
    });
  });

  describe("UI Components Rendering", () => {
    it("renders TokenPicker trigger button and SSR fallback", () => {
      const html = renderToString(
        <TokenPicker
          onSelectToken={vi.fn()}
          buttonLabel="Choose Token"
        />
      );

      expect(html).toContain("data-testid=\"token-picker\"");
      expect(html).toContain("Choose Token");
    });

    it("renders EmailTemplateEditorDialog in SSR mode and returns null when closed", () => {
      const closedHtml = renderToString(
        <EmailTemplateEditorDialog
          open={false}
          onOpenChange={vi.fn()}
        />
      );
      expect(closedHtml).toBe("");

      const openHtml = renderToString(
        <EmailTemplateEditorDialog
          open={true}
          onOpenChange={vi.fn()}
          template={{
            name: "Order Completed",
            subject: "Your order is ready",
            bodyHtml: "<p>Thank you</p>",
          }}
        />
      );
      expect(openHtml).toContain("data-testid=\"email-template-editor-dialog\"");
      expect(openHtml).toContain("Order Completed");
      expect(openHtml).toContain("data-testid=\"email-template-save-btn\"");
    });

    it("renders EmailTemplatesManager with default templates and category filters", () => {
      const html = renderToString(
        <EmailTemplatesManager
          templates={DEFAULT_EMAIL_TEMPLATES}
        />
      );

      expect(html).toContain("data-testid=\"email-templates-manager\"");
      expect(html).toContain("Transactional Email Templates");
      expect(html).toContain("data-testid=\"create-template-btn\"");
      expect(html).toContain("New Template");
    });
  });
});
