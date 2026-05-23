"use server";
import { redirect } from "next/navigation";
import { changeEmail, changePassword, requireUser } from "@/lib/auth";

export type AccountResult = { ok: true } | { ok: false; error: string };

export async function changeEmailAction(formData: FormData): Promise<void> {
  const u = requireUser();
  const password = String(formData.get("password") || "");
  const newEmail = String(formData.get("new_email") || "").trim();
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    redirect("/admin/account?error=invalid_email");
  }
  const ok = await changeEmail(u.id, password, newEmail);
  if (!ok) redirect("/admin/account?error=bad_email");
  redirect("/admin/account?ok=email");
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const u = requireUser();
  const oldPassword = String(formData.get("old_password") || "");
  const newPassword = String(formData.get("new_password") || "");
  const confirm = String(formData.get("confirm_password") || "");
  if (newPassword.length < 6) redirect("/admin/account?error=short");
  if (newPassword !== confirm) redirect("/admin/account?error=mismatch");
  const ok = await changePassword(u.id, oldPassword, newPassword);
  if (!ok) redirect("/admin/account?error=bad_password");
  redirect("/admin/account?ok=password");
}
