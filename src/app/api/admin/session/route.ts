import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, validarTokenAdmin } from "@/lib/adminAuth";
export async function GET(request: NextRequest) {
  return NextResponse.json({ ok: validarTokenAdmin(request.cookies.get(COOKIE_NAME)?.value) });
}
