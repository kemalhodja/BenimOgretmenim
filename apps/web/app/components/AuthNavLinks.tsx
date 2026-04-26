"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";

type LinkProps = {
  className?: string;
  children: ReactNode;
};

export function LoginNavLink({ className, children }: LinkProps) {
  const pathname = usePathname() ?? "";
  return (
    <Link href={loginHrefWithReturn(pathname)} className={className}>
      {children}
    </Link>
  );
}

export function RegisterNavLink({ className, children }: LinkProps) {
  const pathname = usePathname() ?? "";
  return (
    <Link href={registerHrefWithReturn(pathname)} className={className}>
      {children}
    </Link>
  );
}
