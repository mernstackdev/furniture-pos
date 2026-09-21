"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

/**
 * The Supabase browser client, for use inside react-query queryFns.
 *
 * createBrowserClient is already a singleton in the browser — it caches the
 * instance and hands back the same one on every call — so this only pins a
 * single reference per component instead of building a new client per render.
 */
export function useSupabaseBrowser() {
  return useState(createClient)[0];
}
