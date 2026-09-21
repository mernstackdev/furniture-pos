import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SetupForm } from "@/components/SetupForm";

export const metadata: Metadata = {
  title: "Set up · Furniture POS",
};

export default async function SetupPage() {
  // `anon` holds no grant on public.profiles, so the guard lives in a database
  // function that exposes only the boolean.
  const supabase = createClient(await cookies());
  const { data: setupRequired } = await supabase.rpc("is_setup_required");

  if (!setupRequired) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Create the first admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This screen closes permanently once an account exists. All other staff
          accounts are created from the Staff page.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
