"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { documentTitleForPath, panelModeForPath } from "../lib/panelMode";
import { getCachedRole, refreshSessionFromServer, type UserRole } from "../lib/auth";
import { AdminPanelFooter } from "./AdminPanelFooter";
import { AdminPanelHeader } from "./AdminPanelHeader";
import { GuardianPanelFooter } from "./GuardianPanelFooter";
import { GuardianPanelHeader } from "./GuardianPanelHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { RoleRouteGuard } from "./RoleRouteGuard";
import { StudentPanelFooter } from "./StudentPanelFooter";
import { StudentPanelHeader } from "./StudentPanelHeader";
import { TeacherPanelFooter } from "./TeacherPanelFooter";
import { TeacherPanelHeader } from "./TeacherPanelHeader";

type Props = {
  children: ReactNode;
  marketingHeader: ReactNode;
  marketingFooter: ReactNode;
};

export function ConditionalSiteChrome({
  children,
  marketingHeader,
  marketingFooter,
}: Props) {
  const pathname = usePathname() ?? "";
  const pathMode = panelModeForPath(pathname);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);

  const syncRole = useCallback(() => {
    setSessionRole(getCachedRole());
  }, []);

  useEffect(() => {
    let alive = true;
    syncRole();
    void refreshSessionFromServer().then(() => {
      if (alive) syncRole();
    });
    const on = () => syncRole();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      alive = false;
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [syncRole, pathname]);

  useEffect(() => {
    document.title = documentTitleForPath(pathname);
  }, [pathname]);

  /** Vitrinde oturum varsa üst/alt çerçeve de rol paneli gibi davranır (mobil nav ile uyumlu). */
  const chromeMode = pathMode === "marketing" && sessionRole ? sessionRole : pathMode;

  const header =
    chromeMode === "teacher" ? (
      <TeacherPanelHeader />
    ) : chromeMode === "student" ? (
      <StudentPanelHeader />
    ) : chromeMode === "guardian" ? (
      <GuardianPanelHeader />
    ) : chromeMode === "admin" ? (
      <AdminPanelHeader />
    ) : (
      marketingHeader
    );

  const footer =
    chromeMode === "teacher" ? (
      <TeacherPanelFooter />
    ) : chromeMode === "student" ? (
      <StudentPanelFooter />
    ) : chromeMode === "guardian" ? (
      <GuardianPanelFooter />
    ) : chromeMode === "admin" ? (
      <AdminPanelFooter />
    ) : (
      marketingFooter
    );

  return (
    <RoleRouteGuard>
      {header}
      {children}
      {footer}
      <MobileBottomNav />
    </RoleRouteGuard>
  );
}
