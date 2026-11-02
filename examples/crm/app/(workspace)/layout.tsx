"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceShell, type ShellTenant, type ShellUser } from "@honocube/app";
import { app } from "@/lib/cube.app";

const DEMO_TENANTS: ShellTenant[] = [
  { id: "acme-corp", name: "Acme Corporation", plan: "Enterprise" },
  { id: "wayne-intl", name: "Wayne Enterprises", plan: "Scale" },
];

const DEMO_USER: ShellUser = {
  name: "Alex Rivera",
  email: "alex@acme.com",
  role: "Sales Director",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTenantId, setActiveTenantId] = useState("acme-corp");

  return (
    <WorkspaceShell
      app={app}
      pathname={pathname || "/"}
      tenants={DEMO_TENANTS}
      activeTenantId={activeTenantId}
      onTenantChange={setActiveTenantId}
      currentUser={DEMO_USER}
      onNavigate={(href) => router.push(href)}
    >
      {children}
    </WorkspaceShell>
  );
}
