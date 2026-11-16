import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  defineApp,
  defineCollection,
  f,
  AppProvider,
  FormView,
  PhoneInputField,
  FormField,
  parsePhoneNumber,
  COUNTRY_CALLING_CODES,
} from "../src/index.js";

describe("International Phone Input with Country Code Formatting (Issue #128)", () => {
  describe("parsePhoneNumber Utility", () => {
    it("parses US phone numbers correctly", () => {
      const res = parsePhoneNumber("+1 555 123 4567");
      expect(res.country.iso).toBe("US");
      expect(res.country.dialCode).toBe("+1");
      expect(res.nationalNumber).toBe("555 123 4567");
    });

    it("parses UK phone numbers correctly", () => {
      const res = parsePhoneNumber("+44 20 7946 0958");
      expect(res.country.iso).toBe("GB");
      expect(res.country.dialCode).toBe("+44");
      expect(res.nationalNumber).toBe("20 7946 0958");
    });

    it("parses Bangladesh phone numbers with multi-digit prefix", () => {
      const res = parsePhoneNumber("+880 1712 345678");
      expect(res.country.iso).toBe("BD");
      expect(res.country.dialCode).toBe("+880");
      expect(res.nationalNumber).toBe("1712 345678");
    });

    it("falls back to default country when prefix is missing", () => {
      const res = parsePhoneNumber("555-1234", "CA");
      expect(res.country.iso).toBe("CA");
      expect(res.nationalNumber).toBe("555-1234");
    });
  });

  describe("f.phone() Fluent Builder", () => {
    it("builds a phone field with default properties", () => {
      const phoneField = f.phone("Mobile Number").build();

      expect(phoneField.type).toBe("phone");
      expect(phoneField.label).toBe("Mobile Number");
      expect(phoneField.defaultCountry).toBe("US");
    });

    it("supports chained customization methods", () => {
      const customPhone = f.phone("Work Phone")
        .defaultCountry("GB")
        .allowedCountries(["US", "GB", "DE"])
        .preferredCountries(["GB"])
        .build();

      expect(customPhone.type).toBe("phone");
      expect(customPhone.defaultCountry).toBe("GB");
      expect(customPhone.allowedCountries).toEqual(["US", "GB", "DE"]);
      expect(customPhone.preferredCountries).toEqual(["GB"]);
    });
  });

  describe("PhoneInputField Component", () => {
    it("renders country selector and national number input", () => {
      const html = renderToString(
        <PhoneInputField
          name="phone"
          value="+1 555-123-4567"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"phone-input-container\"");
      expect(html).toContain("data-testid=\"phone-country-trigger\"");
      expect(html).toContain("+1");
      expect(html).toContain("data-testid=\"phone-number-input\"");
      expect(html).toContain("555-123-4567");
    });

    it("contains comprehensive list of major country calling codes", () => {
      expect(COUNTRY_CALLING_CODES.length).toBeGreaterThanOrEqual(25);
      const isos = COUNTRY_CALLING_CODES.map((c) => c.iso);
      expect(isos).toContain("US");
      expect(isos).toContain("GB");
      expect(isos).toContain("BD");
      expect(isos).toContain("DE");
      expect(isos).toContain("FR");
      expect(isos).toContain("JP");
    });
  });

  describe("FormField & FormView Integration", () => {
    it("renders PhoneInputField within FormField when field.type is phone", () => {
      const html = renderToString(
        <FormField
          name="telephone"
          field={{
            type: "phone",
            label: "Telephone Contact",
            defaultCountry: "GB",
          }}
          fieldState={{
            value: "+44 20 1234 5678",
            errors: [],
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Telephone Contact");
      expect(html).toContain("data-testid=\"phone-input-container\"");
      expect(html).toContain("+44");
      expect(html).toContain("20 1234 5678");
    });

    it("renders phone field properly in full FormView schema", () => {
      const customers = defineCollection({
        name: "customers",
        fields: {
          id: { type: "text" },
          fullName: { type: "text", label: "Full Name" },
          contactPhone: f.phone("Direct Phone").defaultCountry("US"),
        },
      });

      const app = defineApp({
        title: "CRM",
        apiBaseUrl: "https://api.example.com",
        collections: [customers],
      });

      const queryClient = new QueryClient();
      const mockClient: any = {
        apiBaseUrl: "https://api.example.com",
        get: vi.fn(),
      };

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <AppProvider app={app} client={mockClient}>
            <FormView
              collection={customers}
              initialValues={{
                fullName: "Alice Johnson",
                contactPhone: "+1 800 555 0199",
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("data-testid=\"phone-input-container\"");
      expect(html).toContain("+1");
      expect(html).toContain("800 555 0199");
    });
  });
});
