"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signOut() {
  const supabase = createClient(await cookies());

  // `global` is the SDK default and would sign the user out of every device.
  // A sign-out button should only end the current session.
  await supabase.auth.signOut({ scope: "local" });

  redirect("/login");
}
