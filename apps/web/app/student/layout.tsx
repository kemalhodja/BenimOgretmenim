import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Öğrenci paneli",
    template: "%s · Öğrenci · BenimÖğretmenim",
  },
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
