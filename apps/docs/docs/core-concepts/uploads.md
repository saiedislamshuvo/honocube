# File Uploads

Honocube provides a seamless way to handle file uploads by integrating storage providers directly into the resource lifecycle.

## Storage Configuration

First, define a storage provider in `createApp`.

```typescript
export const { defineResource } = createApp({
  // ...
  storage: {
    upload: async (file, options) => {
      // Implement your upload logic (e.g., S3, Cloudflare R2, Local)
      // Return the public path or key of the file
      const key = `${options.folder}/${Date.now()}_${options.name}`;
      await myS3Client.put(key, file);
      return key;
    },
  },
  // Base URL for resolving media paths in responses
  mediaBaseUrl: "https://cdn.example.com/",
});
```

## Defining Upload Fields

In your resource config, specify which fields should be treated as uploads.

```typescript
export const productsResource = defineResource({
  name: "products",
  // ...
  uploads: {
    image: {
      folder: "products",
    },
    gallery: {
      folder: "products/gallery",
    },
  },
});
```

## How it Works

### 1. Creation & Updates
When you send a `POST` or `PATCH` request with a `File` or `Blob` object in the payload (using `multipart/form-data` or JSON with base64/blobs if supported by your client), Honocube will:
1.  Intercept the file field.
2.  Call your `storage.upload` function.
3.  Replace the file object with the returned path/key before saving to the database.

### 2. Recursive Uploads
Honocube handles uploads even in related records. If you create a `Post` along with several `Image` relation records, the files within those images will be uploaded automatically.

### 3. URL Resolution
When fetching records, Honocube automatically prepends the `mediaBaseUrl` to your upload fields.

- **Database value:** `products/123_thumb.png`
- **API Response:** `https://cdn.example.com/products/123_thumb.png`

This ensures your frontend always receives a fully-qualified URL.

Next, learn about [Searching & Filtering](./search-filter.md).
