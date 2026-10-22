"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      onClick={signOut}
      disabled={busy}
      className={cn("w-full", className)}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? "Signing out" : "Sign out"}
    </Button>
  );
}
