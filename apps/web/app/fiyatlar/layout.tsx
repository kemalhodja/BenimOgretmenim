import { RequireSessionGate } from "../components/RequireSessionGate";

export default function FiyatlarLayout({ children }: { children: React.ReactNode }) {
  return <RequireSessionGate>{children}</RequireSessionGate>;
}
