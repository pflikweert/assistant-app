import { getSession } from "@/services/supabase";
import type { User } from "@supabase/supabase-js";

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("No active user session.");
  }
  return user;
}

export async function requireCurrentUserId(): Promise<string> {
  const user = await requireCurrentUser();
  return user.id;
}
