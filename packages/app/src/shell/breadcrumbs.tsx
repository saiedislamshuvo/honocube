import React from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
} from "@honocube/ui";
import { toHumanLabel } from "../utils/format.js";
import type {
  WorkspaceBreadcrumbsProps,
  BreadcrumbItemData,
} from "./types.js";

/**
 * Parses pathname into a hierarchical breadcrumb trail mapped against app collections.
 */
export function parsePathnameToBreadcrumbs(
  pathname: string = "/",
  app?: WorkspaceBreadcrumbsProps["app"],
  homeLabel: string = "Home"
): BreadcrumbItemData[] {
  const normalized = pathname.trim().replace(/^\/+|\/+$/g, "");
  const segments = normalized ? normalized.split("/") : [];

  const items: BreadcrumbItemData[] = [
    {
      label: homeLabel,
      href: "/",
      isCurrent: segments.length === 0,
    },
  ];

  if (segments.length === 0) {
    return items;
  }

  // Segment 0: Collection
  const colName = segments[0] ?? "";
  if (!colName) {
    return items;
  }
  const collection = app?.getCollection?.(colName);
  const colLabel =
    collection?.label ||
    collection?.singular ||
    toHumanLabel(colName);

  if (segments.length === 1) {
    items.push({
      label: colLabel,
      href: `/${colName}`,
      isCurrent: true,
    });
    return items;
  }

  // Multi-segment: link collection parent
  items.push({
    label: colLabel,
    href: `/${colName}`,
    isCurrent: false,
  });

  // Segment 1: Action (new) or Record ID
  const sub = segments[1] ?? "";
  if (sub === "new") {
    items.push({
      label: `New ${collection?.singular || "Record"}`,
      href: `/${colName}/new`,
      isCurrent: true,
    });
  } else if (sub) {
    items.push({
      label: sub,
      href: `/${colName}/${sub}`,
      isCurrent: true,
    });
  }

  return items;
}

/**
 * Automatic breadcrumb trail component synced with active Next.js pathname.
 */
export function WorkspaceBreadcrumbs({
  app,
  pathname = "/",
  items: explicitItems,
  homeLabel = "Home",
  onNavigate,
  className = "",
}: WorkspaceBreadcrumbsProps): React.JSX.Element {
  const items = explicitItems || parsePathnameToBreadcrumbs(pathname, app, homeLabel);

  return (
    <Breadcrumb
      data-testid="workspace-breadcrumbs"
      className={cn("text-xs sm:text-sm", className)}
    >
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {item.isCurrent || isLast || !item.href ? (
                  <BreadcrumbPage
                    data-testid={`breadcrumb-page-${index}`}
                    className="font-medium text-foreground max-w-[200px] truncate"
                  >
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    data-testid={`breadcrumb-link-${index}`}
                    href={item.href}
                    onClick={(e) => {
                      if (onNavigate && item.href) {
                        e.preventDefault();
                        onNavigate(item.href);
                      }
                    }}
                    className="max-w-[150px] truncate"
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
