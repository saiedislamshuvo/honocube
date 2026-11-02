import type React from "react";
import type { AppInstance } from "../types/app.js";
import type { Collection, InferRecord } from "../types/collection.js";

export type WorkspaceRouteType =
  | "home"
  | "list"
  | "create"
  | "detail"
  | "not-found";

export interface WorkspaceResolvedRoute {
  type: WorkspaceRouteType;
  collectionName?: string;
  collection?: Collection<any>;
  recordId?: string | number;
  slug: string[];
}

export interface WorkspacePageProps {
  app: AppInstance;
  params?:
    | {
        slug?: string[] | string;
        [key: string]: any;
      }
    | Promise<{ slug?: string[] | string; [key: string]: any }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
  dashboard?: React.ReactNode;
  notFoundSlot?: React.ReactNode;
  onNavigate?: (href: string) => void;
  className?: string;
}

export interface WorkspaceDashboardProps {
  app: AppInstance;
  onNavigate?: (href: string) => void;
  className?: string;
}

export interface CollectionDetailPageProps<TCollection extends Collection<any>> {
  collection: TCollection;
  recordId: string | number;
  onNavigate?: (href: string) => void;
  onRecordSaved?: (record: InferRecord<TCollection>) => void;
  className?: string;
}
