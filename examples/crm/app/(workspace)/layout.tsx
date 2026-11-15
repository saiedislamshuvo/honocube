"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceShell, type ShellTenant, type ShellUser } from "@honocube/app";
import { app } from "@/lib/cube.app";

const DEMO_TENANTS: ShellTenant[] = [
  { id: "acme-corp", name: "Acme Corporation", plan: "Enterprise" },
  { id: "wayne-intl", name: "Wayne Enterprises", plan: "Scale" },
];

const DEMO_USERS: ShellUser[] = [
  { name: "Alex Rivera", email: "alex@acme.com", role: "admin" },
  { name: "Sarah Connor", email: "sarah@acme.com", role: "sales" },
  { name: "Guest User", email: "guest@acme.com", role: "viewer" },
];

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTenantId, setActiveTenantId] = useState("acme-corp");
  const [userIndex, setUserIndex] = useState(0);

  const currentUser = DEMO_USERS[userIndex] || DEMO_USERS[0];

  // Sync token to localStorage on role switch for ApiClient bearer auth
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("crm_auth_token", `demo-${currentUser?.role}-token`);
    }
  }, [currentUser]);

  const handleCycleUserRole = () => {
    // Cycle demo roles: Admin -> Sales -> Viewer
    setUserIndex((prev) => (prev + 1) % DEMO_USERS.length);
  };

  return (
    <WorkspaceShell
      app={app}
      pathname={pathname || "/"}
      tenants={DEMO_TENANTS}
      activeTenantId={activeTenantId}
      onTenantChange={setActiveTenantId}
      currentUser={currentUser}
      onSettingsClick={handleCycleUserRole}
      onLogout={() => {
        // Switch to guest/viewer role on logout
        setUserIndex(2);
      }}
      onNavigate={(href) => router.push(href)}
    >
      {children}
    </WorkspaceShell>
  );
}
