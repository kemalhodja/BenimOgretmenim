import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Yönetim",
    template: "%s · Yönetim · BenimÖğretmenim",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
