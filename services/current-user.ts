import { supabase } from "@/services/supabase";
import type { User } from "@supabase/supabase-js";

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
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
