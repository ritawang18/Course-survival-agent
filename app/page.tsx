"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/dashboard" : "/login");
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center animate-pulse">
          <GraduationCap className="h-5 w-5 text-accent" />
        </div>
        <p className="text-xs">Loading…</p>
      </div>
    </div>
  );
}
