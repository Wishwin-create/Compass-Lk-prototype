import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AdminCheck = { isAdmin: boolean; loading: boolean };

export default function useAdmin(): AdminCheck {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) {
          if (mounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        // Prefer server-side admin_users table check (recommended). This query will
        // work for anon/public keys if you have a row-level policy that allows it,
        // otherwise it will return an error and we gracefully treat as non-admin.
        const { data, error } = await supabase
          .from("admin_users")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (!error && data && data.length > 0) {
          if (mounted) setIsAdmin(true);
        } else {
          // fallback: check if user has an admin email in env list (client-side only)
          const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
          if (adminEmails.includes((user.email || "").toLowerCase())) {
            if (mounted) setIsAdmin(true);
          } else {
            if (mounted) setIsAdmin(false);
          }
        }
      } catch (err) {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      try {
        // newer Supabase returns { data: { subscription } }
        // be defensive in case shape differs
        // @ts-ignore
        sub?.subscription?.unsubscribe?.();
      } catch (e) {
        // ignore unsubscribe errors
      }
    };
  }, []);

  return { isAdmin, loading };
}
