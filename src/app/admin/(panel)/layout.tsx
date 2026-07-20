import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { getSharedConfig } from "@/lib/studio-settings";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = getCurrentUser();
  if (!u) redirect("/admin/login");

  const [msgRow, shared] = await Promise.all([
    queryOne<{ c: number }>(
      "SELECT COUNT(*)::int as c FROM messages WHERE read_at IS NULL"
    ),
    getSharedConfig().catch(() => ({} as Record<string, string>)),
  ]);
  const unread = msgRow?.c ?? 0;

  return (
    <AdminShell
      unread={unread}
      profile={{
        name: shared.admin_name || u.email.split("@")[0],
        email: shared.admin_email || u.email,
        picture: shared.admin_picture || undefined,
      }}
    >
      {children}
    </AdminShell>
  );
}
