import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Veli paneli",
    template: "%s · Veli · BenimÖğretmenim",
  },
  robots: { index: false, follow: false },
};

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
