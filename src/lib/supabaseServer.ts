import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseServerConfigurado = Boolean(url && serviceKey);
export const supabaseServer = supabaseServerConfigurado
  ? createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
