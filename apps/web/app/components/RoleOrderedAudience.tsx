"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { getRoleFromToken, getToken } from "../lib/auth";

type Props = {
  studentSlot: ReactNode;
  teacherSlot: ReactNode;
};

export function RoleOrderedAudience({ studentSlot, teacherSlot }: Props) {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const sync = useCallback(() => setToken(getToken()), []);

  useEffect(() => {
    setMounted(true);
    sync();
  }, [sync]);

  useEffect(() => {
    const on = () => sync();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [sync]);

  const role = mounted ? getRoleFromToken(token) : null;
  const teacherFirst = role === "teacher" || role === "admin";
  const studentOrder = teacherFirst ? "sm:order-2" : "";
  const teacherOrder = teacherFirst ? "sm:order-1" : "";

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 sm:gap-10 sm:px-6">
      <div className={`min-w-0 ${studentOrder}`}>{studentSlot}</div>
      <div className={`min-w-0 ${teacherOrder}`}>{teacherSlot}</div>
    </div>
  );
}
