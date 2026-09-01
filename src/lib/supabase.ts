import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigurado =
  !!url &&
  !!anonKey &&
  url.startsWith("https://") &&
  url.includes(".supabase.co");

// createClient lança erro se receber URL/chave vazias. Isso quebrava QUALQUER
// página que importasse este arquivo (mesmo sem usar o Supabase ainda),
// como acontecia em /room/create. Usamos valores de placeholder quando não
// configurado, e todo o resto do app já respeita a flag `supabaseConfigurado`
// antes de fazer chamadas reais.
export const supabase = createClient(
  supabaseConfigurado ? url! : "https://placeholder.supabase.co",
  supabaseConfigurado ? anonKey! : "placeholder-anon-key",
);

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