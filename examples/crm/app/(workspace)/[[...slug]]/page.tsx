"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { WorkspacePage } from "@honocube/app";
import { app } from "@/lib/cube.app";

export default function WorkspaceCatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const router = useRouter();

  return (
    <WorkspacePage
      app={app}
      params={params}
      searchParams={searchParams}
      onNavigate={(href) => router.push(href)}
    />
  );
}
