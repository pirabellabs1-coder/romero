import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = getCurrentUser();
  if (!u) redirect("/admin/login");

  const unread = (getDb().prepare("SELECT COUNT(*) as c FROM messages WHERE read_at IS NULL").get() as { c: number }).c;

  return <AdminShell unread={unread}>{children}</AdminShell>;
}
