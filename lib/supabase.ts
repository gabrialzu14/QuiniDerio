import { createClient } from "@supabase/supabase-js";

const url = "https://bwonxnayayopbohxuphs.supabase.co";
const publishableKey = "sb_publishable_k0vRQvM6VQtxUcqnyuUGLA_qE6APi09";

export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true }
});
