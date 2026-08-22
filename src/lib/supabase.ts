import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigurado =
  !!url &&
  !!anonKey &&
  url.startsWith("https://") &&
  url.includes(".supabase.co");

export const supabase = createClient(url!, anonKey!);

export async function testarConexaoSupabase() {
  try {
    const { error } = await supabase
      .from("sala")
      .select("id")
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

export function canalDaSala(codigo: string, meuId: string) {
  return supabase.channel(`sala:${codigo}`, {
    config: {
      presence: {
        key: meuId,
      },
    },
  });
}