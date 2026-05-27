"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDbAsync } from "@/lib/db";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";

// CRITICAL: see lib/db.ts — sync getDb() on a cold lambda opens the seed,
// so any write would push seed+1edit to Blob and wipe everything else.

export async function markRead(id: number) {
  requireUser();
  const db = await getDbAsync();
  db
    .prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ?")
    .run(id);
  await syncDb();
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function markUnread(id: number) {
  requireUser();
  const db = await getDbAsync();
  db.prepare("UPDATE messages SET read_at = NULL WHERE id = ?").run(id);
  await syncDb();
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function deleteMessage(id: number) {
  requireUser();
  const db = await getDbAsync();
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);
  await syncDb();
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
  redirect("/admin/messages");
}
