import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = getCurrentUser();
  if (!u) redirect("/admin/login");

  const row = await queryOne<{ c: number }>(
    "SELECT COUNT(*)::int as c FROM messages WHERE read_at IS NULL"
  );
  const unread = row?.c ?? 0;

  return <AdminShell unread={unread}>{children}</AdminShell>;
}
