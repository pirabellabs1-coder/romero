"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markRead(id: number) {
  requireUser();
  await execute("UPDATE messages SET read_at = NOW() WHERE id = $1", [id]);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function markUnread(id: number) {
  requireUser();
  await execute("UPDATE messages SET read_at = NULL WHERE id = $1", [id]);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}

export async function deleteMessage(id: number) {
  requireUser();
  await execute("DELETE FROM messages WHERE id = $1", [id]);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
  redirect("/admin/messages");
}
