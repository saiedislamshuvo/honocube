import type { AppInstance } from "../types/app.js";
import type { WorkspaceResolvedRoute } from "./types.js";

/**
 * Pure route resolver that maps Next.js URL slugs to workspace views
 * (home, collection list, create form, record detail, or not-found).
 */
export function resolveWorkspaceRoute(
  app: AppInstance,
  slug?: string[] | string
): WorkspaceResolvedRoute {
  let slugArray: string[] = [];

  if (Array.isArray(slug)) {
    slugArray = slug.filter(Boolean);
  } else if (typeof slug === "string" && slug.trim()) {
    slugArray = slug
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
  }

  // 1. Root / Home route
  if (slugArray.length === 0) {
    return {
      type: "home",
      slug: [],
    };
  }

  const collectionName = slugArray[0] ?? "";
  const collection = app.getCollection ? app.getCollection(collectionName) : undefined;

  // 2. Collection not found
  if (!collection) {
    return {
      type: "not-found",
      collectionName,
      slug: slugArray,
    };
  }

  // 3. Collection List route
  if (slugArray.length === 1) {
    return {
      type: "list",
      collectionName,
      collection,
      slug: slugArray,
    };
  }

  const sub = slugArray[1] ?? "";

  // 4. Create Record route
  if (sub === "new") {
    return {
      type: "create",
      collectionName,
      collection,
      slug: slugArray,
    };
  }

  // 5. View / Edit Record detail route
  return {
    type: "detail",
    collectionName,
    collection,
    recordId: sub,
    slug: slugArray,
  };
}
