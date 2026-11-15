import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MediaLibrary,
  MediaLibraryDialog,
  ImagePickerField,
  FormField,
  f,
  defineCollection,
  type MediaAsset,
} from "../src/index.js";

describe("Media Library and Image Picker (Issue #113)", () => {
  const sampleAssets: MediaAsset[] = [
    {
      id: "asset-1",
      url: "https://images.unsplash.com/photo-1",
      name: "hero-banner.webp",
      size: 245000,
      mimeType: "image/webp",
      width: 1920,
      height: 1080,
      alt: "Hero Banner",
    },
    {
      id: "asset-2",
      url: "https://images.unsplash.com/photo-2",
      name: "company-logo.png",
      size: 45000,
      mimeType: "image/png",
      width: 400,
      height: 400,
      alt: "Company Logo",
    },
    {
      id: "asset-3",
      url: "https://files.example.com/spec-sheet.pdf",
      name: "product-spec.pdf",
      size: 1520000,
      mimeType: "application/pdf",
    },
  ];

  describe("MediaLibrary Component", () => {
    it("renders media library toolbar, dropzone, and asset grid", () => {
      const html = renderToString(
        <MediaLibrary assets={sampleAssets} />
      );

      // Search & category filters
      expect(html).toContain("data-testid=\"media-search-input\"");
      expect(html).toContain("data-testid=\"filter-tab-all\"");
      expect(html).toContain("data-testid=\"filter-tab-images\"");
      expect(html).toContain("data-testid=\"filter-tab-documents\"");

      // Upload trigger & dropzone
      expect(html).toContain("data-testid=\"media-upload-trigger\"");
      expect(html).toContain("data-testid=\"media-dropzone\"");

      // Asset cards
      expect(html).toContain("data-testid=\"media-asset-card-asset-1\"");
      expect(html).toContain("hero-banner.webp");
      expect(html).toContain("239.3 KB"); // 245000 bytes
      expect(html).toContain("1920×1080");

      expect(html).toContain("data-testid=\"media-asset-card-asset-2\"");
      expect(html).toContain("company-logo.png");

      expect(html).toContain("data-testid=\"media-asset-card-asset-3\"");
      expect(html).toContain("product-spec.pdf");

      // Footer summary
      expect(html).toContain("3 assets available");
    });

    it("renders empty state when asset list is empty", () => {
      const html = renderToString(<MediaLibrary assets={[]} />);
      expect(html).toContain("data-testid=\"media-empty-state\"");
      expect(html).toContain("No media assets found");
    });

    it("renders selected indicator for pre-selected assets", () => {
      const html = renderToString(
        <MediaLibrary
          assets={sampleAssets}
          selected="asset-1"
        />
      );

      expect(html).toContain("data-testid=\"asset-selected-badge-asset-1\"");
      expect(html).toContain("data-testid=\"media-selected-badge\"");
      expect(html).toContain("1 selected");
    });

    it("supports multiple pre-selected assets", () => {
      const html = renderToString(
        <MediaLibrary
          assets={sampleAssets}
          selected={["asset-1", "asset-2"]}
          multiple
        />
      );

      expect(html).toContain("data-testid=\"asset-selected-badge-asset-1\"");
      expect(html).toContain("data-testid=\"asset-selected-badge-asset-2\"");
      expect(html).toContain("2 selected");
    });

    it("renders delete buttons when onDelete handler is provided", () => {
      const onDelete = vi.fn();
      const html = renderToString(
        <MediaLibrary
          assets={sampleAssets}
          onDelete={onDelete}
        />
      );

      expect(html).toContain("data-testid=\"delete-asset-asset-1\"");
      expect(html).toContain("data-testid=\"delete-asset-asset-2\"");
      expect(html).toContain("data-testid=\"delete-asset-asset-3\"");
    });
  });

  describe("MediaLibraryDialog Component", () => {
    it("renders dialog trigger button and metadata when open or closed", () => {
      const html = renderToString(
        <MediaLibraryDialog
          open={false}
          title="Product Media Gallery"
          description="Select visual assets for this product."
          assets={sampleAssets}
          trigger={<button id="open-media-dialog-btn">Browse Media</button>}
        />
      );

      expect(html).toContain("Browse Media");
      expect(html).toContain('id="open-media-dialog-btn"');
    });
  });

  describe("ImagePickerField Component", () => {
    it("renders empty dropzone trigger when value is empty in single mode", () => {
      const onChange = vi.fn();
      const html = renderToString(
        <ImagePickerField
          id="thumbnail"
          value={null}
          onChange={onChange}
          placeholder="Upload product thumbnail"
        />
      );

      expect(html).toContain("data-testid=\"image-picker-thumbnail\"");
      expect(html).toContain("data-testid=\"image-picker-empty\"");
      expect(html).toContain("Upload product thumbnail");
      expect(html).toContain("or drag and drop here");
    });

    it("renders preview card with Change and Remove actions when single value is present", () => {
      const onChange = vi.fn();
      const html = renderToString(
        <ImagePickerField
          id="avatar"
          value="https://images.unsplash.com/photo-avatar.jpg"
          onChange={onChange}
        />
      );

      expect(html).toContain("data-testid=\"image-picker-preview\"");
      expect(html).toContain("photo-avatar.jpg");
      expect(html).toContain("data-testid=\"image-picker-change-btn\"");
      expect(html).toContain("data-testid=\"image-picker-remove-btn\"");
      expect(html).toContain("Change");
    });

    it("renders preview card with rich MediaAsset object metadata", () => {
      const onChange = vi.fn();
      const asset: MediaAsset = {
        id: "logo-asset",
        url: "https://example.com/brand-logo.png",
        name: "brand-logo.png",
        size: 102400,
        width: 800,
        height: 600,
      };

      const html = renderToString(
        <ImagePickerField
          id="logo"
          value={asset}
          onChange={onChange}
        />
      );

      expect(html).toContain("brand-logo.png");
      expect(html).toContain("100.0 KB");
      expect(html).toContain("800×600");
    });

    it("renders gallery view with thumbnail cards and add card in multiple mode", () => {
      const onChange = vi.fn();
      const galleryValues = [
        "https://example.com/gallery-1.jpg",
        "https://example.com/gallery-2.jpg",
      ];

      const html = renderToString(
        <ImagePickerField
          id="gallery"
          value={galleryValues}
          onChange={onChange}
          multiple
        />
      );

      expect(html).toContain("data-testid=\"image-picker-gallery\"");
      expect(html).toContain("2 images selected");
      expect(html).toContain("data-testid=\"gallery-item-0\"");
      expect(html).toContain("data-testid=\"gallery-item-1\"");
      expect(html).toContain("data-testid=\"gallery-remove-0\"");
      expect(html).toContain("data-testid=\"gallery-remove-1\"");
      expect(html).toContain("data-testid=\"gallery-add-card\"");
      expect(html).toContain("Add Image");
      expect(html).toContain("data-testid=\"image-picker-clear-all\"");
    });
  });

  describe("FormField Integration with image and media field types", () => {
    it("renders ImagePickerField inside FormField for single image field", () => {
      const onChange = vi.fn();
      const html = renderToString(
        <FormField
          name="heroImage"
          field={{
            type: "image",
            label: "Hero Banner",
            placeholder: "Select banner image",
          }}
          fieldState={{ value: "" }}
          onChange={onChange}
        />
      );

      expect(html).toContain("Hero Banner");
      expect(html).toContain("data-testid=\"image-picker-heroImage\"");
      expect(html).toContain("Select banner image");
    });

    it("renders ImagePickerField gallery inside FormField for multiple media field", () => {
      const onChange = vi.fn();
      const html = renderToString(
        <FormField
          name="productImages"
          field={{
            type: "media",
            label: "Product Gallery",
            multiple: true,
          }}
          fieldState={{
            value: ["https://example.com/pic1.jpg", "https://example.com/pic2.jpg"],
          }}
          onChange={onChange}
        />
      );

      expect(html).toContain("Product Gallery");
      expect(html).toContain("data-testid=\"image-picker-gallery\"");
      expect(html).toContain("2 images selected");
    });

    it("integrates with defineCollection schema using fluent builders", () => {
      const productsCollection = defineCollection({
        name: "products",
        fields: {
          title: f.text("Product Title").required(),
          mainImage: f.image("Main Thumbnail").required(),
          gallery: f.image("Gallery").multiple(),
        },
      });

      expect(productsCollection.fields.mainImage.type).toBe("image");
      expect(productsCollection.fields.mainImage.required).toBe(true);
      expect(productsCollection.fields.gallery.type).toBe("image");
      expect(productsCollection.fields.gallery.multiple).toBe(true);
    });
  });
});
