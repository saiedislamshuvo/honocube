import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  CustomFieldsManagerDialog,
  CustomFieldsFormSection,
} from "../src/index.js";
import type { CustomFieldDefinition } from "@honocube/core";

describe("Custom Fields UI Components (Issue #141)", () => {
  const mockCustomFields: CustomFieldDefinition[] = [
    {
      id: "cf-1",
      collection: "orders",
      name: "serialNumber",
      label: "Serial Number",
      type: "text",
      required: true,
      placeholder: "SN-000",
    },
    {
      id: "cf-2",
      collection: "orders",
      name: "warrantyPeriod",
      label: "Warranty (Years)",
      type: "number",
      defaultValue: 2,
    },
    {
      id: "cf-3",
      collection: "orders",
      name: "rushDelivery",
      label: "Rush Delivery",
      type: "boolean",
    },
    {
      id: "cf-4",
      collection: "orders",
      name: "channelSource",
      label: "Channel Source",
      type: "select",
      options: ["Direct", "Partner", "Affiliate"],
    },
  ];

  it("renders CustomFieldsManagerDialog safely in SSR when open", () => {
    const html = renderToString(
      <CustomFieldsManagerDialog
        open={true}
        onOpenChange={vi.fn()}
        collectionName="orders"
        customFields={mockCustomFields}
        onSaveField={vi.fn()}
        onDeleteField={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"custom-fields-manager-dialog\"");
    expect(html).toContain("Manage Custom Fields for orders");
  });

  it("renders nothing when CustomFieldsManagerDialog is closed", () => {
    const html = renderToString(
      <CustomFieldsManagerDialog
        open={false}
        onOpenChange={vi.fn()}
        collectionName="orders"
      />
    );

    expect(html).toBe("");
  });

  it("renders CustomFieldsFormSection with varied input types and error messages", () => {
    const html = renderToString(
      <CustomFieldsFormSection
        customFields={mockCustomFields}
        values={{
          serialNumber: "SN-9988",
          warrantyPeriod: 3,
          rushDelivery: true,
          channelSource: "Direct",
        }}
        onChange={vi.fn()}
        errors={{
          serialNumber: "Serial number already registered",
        }}
      />
    );

    expect(html).toContain("data-testid=\"custom-fields-form-section\"");
    expect(html).toContain("Serial Number");
    expect(html).toContain("Warranty (Years)");
    expect(html).toContain("Rush Delivery");
    expect(html).toContain("Channel Source");
    expect(html).toContain("Serial number already registered");
    expect(html).toContain("SN-9988");
  });

  it("renders null when customFields list is empty in CustomFieldsFormSection", () => {
    const html = renderToString(
      <CustomFieldsFormSection
        customFields={[]}
        values={{}}
        onChange={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
