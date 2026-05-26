"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";

export async function markRead(id: number) {
  requireUser();
  getDb()
    .prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ?")
    .run(id);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function markUnread(id: number) {
  requireUser();
  getDb().prepare("UPDATE messages SET read_at = NULL WHERE id = ?").run(id);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function deleteMessage(id: number) {
  requireUser();
  getDb().prepare("DELETE FROM messages WHERE id = ?").run(id);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
  await syncDb();
  redirect("/admin/messages");
}
