import { useSession } from "@/app/_layout";
import {
  getSession,
  isDevAuthBypassEnabled,
  supabase,
} from "@/services/supabase";
import type { User } from "@supabase/supabase-js";
import React from "react";

export type AdminAccessState = {
  loading: boolean;
  isAdmin: boolean;
  role: string | null;
  user: User | null;
};

function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function getCurrentUserProfile() {
  const session = await getSession();
  const user = session?.user ?? null;
  if (!user) return { user: null, role: null };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[admin-access] profile lookup failed", error);
    }

    const role = normalizeRole(data?.role) || normalizeRole(user.role);
    return { user, role: role || null };
  } catch (error) {
    console.warn("[admin-access] profile lookup crashed", error);
    return { user, role: normalizeRole(user.role) || null };
  }
}

export async function isCurrentUserAdmin() {
  const { user, role } = await getCurrentUserProfile();
  if (!user) return false;
  if (role === "admin") return true;

  if (isDevAuthBypassEnabled) {
    return normalizeRole(user.role) === "admin";
  }

  return false;
}

export function useAdminAccess(): AdminAccessState {
  const { user } = useSession();
  const [state, setState] = React.useState<AdminAccessState>({
    loading: true,
    isAdmin: false,
    role: null,
    user: null,
  });

  React.useEffect(() => {
    let active = true;

    void (async () => {
      if (!user) {
        if (active) {
          setState({
            loading: false,
            isAdmin: false,
            role: null,
            user: null,
          });
        }
        return;
      }

      try {
        const profile = await getCurrentUserProfile();
        if (!active) return;

        const fallbackRole = normalizeRole(user.role);
        const role = profile.role || (isDevAuthBypassEnabled ? fallbackRole : null);

        setState({
          loading: false,
          isAdmin: role === "admin",
          role,
          user: profile.user || user,
        });
      } catch (error) {
        console.warn("[admin-access] access check failed", error);
        if (!active) return;
        const fallbackRole = normalizeRole(user.role);
        setState({
          loading: false,
          isAdmin: isDevAuthBypassEnabled && fallbackRole === "admin",
          role: fallbackRole || null,
          user,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  return state;
}
