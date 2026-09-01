import { NextResponse } from "next/server";
import { supabaseServer, supabaseServerConfigurado } from "@/lib/supabaseServer";

export async function GET() {
  if (!supabaseServerConfigurado || !supabaseServer) return NextResponse.json({ configured: false, overrides: [] });
  const { data, error } = await supabaseServer.from("overall_overrides").select("year, player_id, player_name, overall, updated_at").order("year").order("player_name");
  if (error) return NextResponse.json({ configured: true, error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, overrides: data ?? [] });
}
