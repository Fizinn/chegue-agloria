import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseServerConfigurado } from "@/lib/supabaseServer";
import { COOKIE_NAME, validarTokenAdmin } from "@/lib/adminAuth";
import { encontrarJogadorRegistro } from "@/lib/playerRegistry";

function autorizado(request: NextRequest) {
  return validarTokenAdmin(request.cookies.get(COOKIE_NAME)?.value);
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!supabaseServerConfigurado || !supabaseServer) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.overrides) ? body.overrides : [];

  if (!rows.length || rows.length > 5000) {
    return NextResponse.json({ ok: false, error: "Envie entre 1 e 5000 registros." }, { status: 400 });
  }

  const validos: Array<{
    year: number;
    player_id: string;
    player_name: string;
    overall: number;
    updated_at: string;
  }> = [];
  const rejeitados: Array<{ index: number; error: string }> = [];

  rows.forEach((row: any, index: number) => {
    const year = Number(row?.year);
    const overall = Number(row?.overall);
    const playerId = typeof row?.playerId === "string" ? row.playerId.trim() : "";
    const playerName = typeof row?.playerName === "string" ? row.playerName.trim() : "";

    if (!Number.isInteger(year) || !playerId || !Number.isInteger(overall) || overall < 52 || overall > 99) {
      rejeitados.push({ index, error: "Ano, player_id e overall inválidos." });
      return;
    }

    const jogador = encontrarJogadorRegistro(year, playerId);
    if (!jogador) {
      rejeitados.push({ index, error: `player_id "${playerId}" não existe na Copa ${year}.` });
      return;
    }

    validos.push({
      year,
      player_id: jogador.playerId,
      player_name: playerName || jogador.nome,
      overall,
      updated_at: new Date().toISOString(),
    });
  });

  if (rejeitados.length) {
    return NextResponse.json(
      { ok: false, error: "Importação recusada: existem registros inválidos.", rejeitados },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer
    .from("overall_overrides")
    .upsert(validos, { onConflict: "year,player_id" })
    .select("year, player_id, player_name, overall, updated_at");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: data?.length ?? validos.length, overrides: data ?? validos });
}
