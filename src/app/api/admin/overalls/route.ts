import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseServerConfigurado } from "@/lib/supabaseServer";
import { COOKIE_NAME, validarTokenAdmin } from "@/lib/adminAuth";
import { encontrarJogadorRegistro } from "@/lib/playerRegistry";

function autorizado(request: NextRequest) {
  return validarTokenAdmin(request.cookies.get(COOKIE_NAME)?.value);
}

function validarLinha(body: any) {
  const year = Number(body?.year);
  const overall = Number(body?.overall);
  const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
  const playerName = typeof body?.playerName === "string" ? body.playerName.trim() : "";

  if (
    !Number.isInteger(year) ||
    !playerId ||
    !Number.isInteger(overall) ||
    overall < 52 ||
    overall > 99
  ) {
    return { error: "Ano, player_id e overall são obrigatórios; overall deve ficar entre 52 e 99." };
  }

  const jogador = encontrarJogadorRegistro(year, playerId);
  if (!jogador) {
    return { error: `player_id "${playerId}" não pertence a um jogador da Copa ${year}.` };
  }

  return {
    value: {
      year,
      player_id: jogador.playerId,
      player_name: playerName || jogador.nome,
      overall,
      updated_at: new Date().toISOString(),
    },
  };
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!supabaseServerConfigurado || !supabaseServer) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const validado = validarLinha(body);
  if ("error" in validado) {
    return NextResponse.json({ ok: false, error: validado.error }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("overall_overrides")
    .upsert(validado.value, { onConflict: "year,player_id" })
    .select("year, player_id, player_name, overall, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, override: data });
}

export async function DELETE(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!supabaseServerConfigurado || !supabaseServer) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";

  if (!Number.isInteger(year) || !playerId) {
    return NextResponse.json({ ok: false, error: "Ano e player_id são obrigatórios." }, { status: 400 });
  }

  const jogador = encontrarJogadorRegistro(year, playerId);
  if (!jogador) {
    return NextResponse.json({ ok: false, error: "Jogador não encontrado nessa Copa." }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("overall_overrides")
    .delete()
    .eq("year", year)
    .eq("player_id", jogador.playerId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
