import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Öğretmen paneli",
    template: "%s · Öğretmen · BenimÖğretmenim",
  },
  robots: { index: false, follow: false },
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
