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
  FormField,
  AsyncCombobox,
  type ComboboxOption,
} from "../src/index.js";

describe("Async Searchable Combobox for Large Relational Datasets (Issue #120)", () => {
  describe("f.relation() Fluent Builder Extensions", () => {
    it("builds relation field with standard and enhanced async options", () => {
      const relField = f.relation("customers", "Select Customer")
        .valueKey("uuid")
        .labelKey("companyName")
        .subtitleKey("accountNumber")
        .pageSize(50)
        .debounceMs(250)
        .endpoint("/api/v2/customers")
        .filter({ active: true })
        .clearable(true)
        .searchable(true)
        .build();

      expect(relField.type).toBe("relation");
      expect(relField.target).toBe("customers");
      expect(relField.label).toBe("Select Customer");
      expect(relField.valueKey).toBe("uuid");
      expect(relField.labelKey).toBe("companyName");
      expect(relField.subtitleKey).toBe("accountNumber");
      expect(relField.pageSize).toBe(50);
      expect(relField.debounceMs).toBe(250);
      expect(relField.endpoint).toBe("/api/v2/customers");
      expect(relField.filterParams).toEqual({ active: true });
      expect(relField.clearable).toBe(true);
      expect(relField.searchable).toBe(true);
    });

    it("defaults to standard configuration when unspecified", () => {
      const basicRel = f.relation("suppliers").build();

      expect(basicRel.type).toBe("relation");
      expect(basicRel.target).toBe("suppliers");
      expect(basicRel.pageSize).toBeUndefined();
      expect(basicRel.debounceMs).toBeUndefined();
    });
  });

  describe("AsyncCombobox Component Rendering", () => {
    const sampleOptions: ComboboxOption[] = [
      { value: "cust_1", label: "Acme Corporation", subtitle: "ACC-001" },
      { value: "cust_2", label: "Globex Industries", subtitle: "ACC-002" },
      { value: "cust_3", label: "Soylent Corp", subtitle: "ACC-003", disabled: true },
    ];

    it("renders trigger button with placeholder when unselected", () => {
      const html = renderToString(
        <AsyncCombobox
          name="customer"
          value={null}
          placeholder="Choose a customer..."
          options={sampleOptions}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"async-combobox-trigger\"");
      expect(html).toContain("Choose a customer...");
      expect(html).toContain("role=\"combobox\"");
      expect(html).not.toContain("data-testid=\"async-combobox-clear\"");
    });

    it("renders selected option label and subtitle in trigger", () => {
      const html = renderToString(
        <AsyncCombobox
          name="customer"
          value="cust_2"
          options={sampleOptions}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"async-combobox-trigger\"");
      expect(html).toContain("Globex Industries");
      expect(html).toContain("ACC-002");
      expect(html).toContain("data-testid=\"async-combobox-clear\"");
    });

    it("omits clear button when clearable is false or input is disabled", () => {
      const noClearHtml = renderToString(
        <AsyncCombobox
          name="customer"
          value="cust_1"
          clearable={false}
          options={sampleOptions}
          onChange={vi.fn()}
        />
      );

      expect(noClearHtml).not.toContain("data-testid=\"async-combobox-clear\"");

      const disabledHtml = renderToString(
        <AsyncCombobox
          name="customer"
          value="cust_1"
          disabled={true}
          options={sampleOptions}
          onChange={vi.fn()}
        />
      );

      expect(disabledHtml).not.toContain("data-testid=\"async-combobox-clear\"");
      expect(disabledHtml.toLowerCase()).toContain("disabled");
    });

    it("applies error styling when hasError is true", () => {
      const html = renderToString(
        <AsyncCombobox
          name="customer"
          value={null}
          hasError={true}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("border-destructive");
    });

    it("renders readOnly state with muted background", () => {
      const html = renderToString(
        <AsyncCombobox
          name="customer"
          value="cust_1"
          readOnly={true}
          options={sampleOptions}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("cursor-default");
      expect(html).toContain("bg-muted");
    });
  });

  describe("FormField & FormView Integration", () => {
    it("renders AsyncCombobox for relation fields inside FormField", () => {
      const html = renderToString(
        <FormField
          name="customerId"
          field={{
            type: "relation",
            target: "customers",
            label: "Account Owner",
            placeholder: "Search account...",
            valueKey: "id",
            labelKey: "name",
            subtitleKey: "email",
          }}
          fieldState={{ value: null, errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Account Owner");
      expect(html).toContain("data-testid=\"async-combobox-trigger\"");
      expect(html).toContain("Search account...");
    });

    it("renders relation combobox inside FormView schema", () => {
      const invoices = defineCollection({
        name: "invoices",
        fields: {
          id: { type: "text" },
          customer: f.relation("customers", "Customer")
            .valueKey("id")
            .labelKey("name")
            .subtitleKey("taxNumber"),
        },
      });

      const app = defineApp({
        title: "Billing Portal",
        apiBaseUrl: "https://api.example.com",
        collections: [invoices],
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
              collection={invoices}
              initialValues={{
                customer: "cust_999",
              }}
            />
          </AppProvider>
        </QueryClientProvider>
      );

      expect(html).toContain("Customer");
      expect(html).toContain("data-testid=\"async-combobox-trigger\"");
      expect(html).toContain("cust_999");
      expect(html).toContain("data-testid=\"async-combobox-clear\"");
    });
  });

  describe("Inline Foreign Key Entity Creation (Issue #147)", () => {
    it("renders companion quick-add + button when createInline is enabled", () => {
      const html = renderToString(
        <AsyncCombobox
          name="supplierId"
          target="suppliers"
          value={null}
          createInline={true}
          createTitle="New Supplier"
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("data-testid=\"async-combobox-quick-add\"");
      expect(html).toContain("Create new New Supplier");
    });

    it("omits quick-add button when createInline is false or component is disabled", () => {
      const disabledHtml = renderToString(
        <AsyncCombobox
          name="supplierId"
          target="suppliers"
          value={null}
          createInline={true}
          disabled={true}
          onChange={vi.fn()}
        />
      );

      expect(disabledHtml).not.toContain("data-testid=\"async-combobox-quick-add\"");

      const defaultHtml = renderToString(
        <AsyncCombobox
          name="supplierId"
          target="suppliers"
          value={null}
          createInline={false}
          onChange={vi.fn()}
        />
      );

      expect(defaultHtml).not.toContain("data-testid=\"async-combobox-quick-add\"");
    });

    it("configures relation builder with .createInline(true, { title, description })", () => {
      const builder = f.relation("brands", "Brand")
        .createInline(true, {
          title: "Quick Create Brand",
          description: "Add a brand without navigating away",
        })
        .build();

      expect(builder.createInline).toBe(true);
      expect(builder.createTitle).toBe("Quick Create Brand");
      expect(builder.createDescription).toBe("Add a brand without navigating away");
    });

    it("integrates with FormField to render quick-add + button for relational inputs", () => {
      const html = renderToString(
        <FormField
          name="brandId"
          field={{
            type: "relation",
            target: "brands",
            label: "Product Brand",
            createInline: true,
            createTitle: "New Brand",
          }}
          fieldState={{ value: null, errors: [] } as any}
          onChange={vi.fn()}
        />
      );

      expect(html).toContain("Product Brand");
      expect(html).toContain("data-testid=\"async-combobox-quick-add\"");
    });
  });
});
