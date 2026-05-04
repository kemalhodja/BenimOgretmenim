"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { documentTitleForPath, panelModeForPath } from "../lib/panelMode";
import { AdminPanelFooter } from "./AdminPanelFooter";
import { AdminPanelHeader } from "./AdminPanelHeader";
import { GuardianPanelFooter } from "./GuardianPanelFooter";
import { GuardianPanelHeader } from "./GuardianPanelHeader";
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
  const mode = panelModeForPath(pathname);

  useEffect(() => {
    document.title = documentTitleForPath(pathname);
  }, [pathname]);

  const header =
    mode === "teacher" ? (
      <TeacherPanelHeader />
    ) : mode === "student" ? (
      <StudentPanelHeader />
    ) : mode === "guardian" ? (
      <GuardianPanelHeader />
    ) : mode === "admin" ? (
      <AdminPanelHeader />
    ) : (
      marketingHeader
    );

  const footer =
    mode === "teacher" ? (
      <TeacherPanelFooter />
    ) : mode === "student" ? (
      <StudentPanelFooter />
    ) : mode === "guardian" ? (
      <GuardianPanelFooter />
    ) : mode === "admin" ? (
      <AdminPanelFooter />
    ) : (
      marketingFooter
    );

  return (
    <>
      {header}
      {children}
      {footer}
    </>
  );
}
