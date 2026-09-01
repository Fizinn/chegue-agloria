import { NextResponse } from "next/server";
import { COOKIE_NAME, criarTokenAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const senha = process.env.ADMIN_PASSWORD || "0707";
  if (pin !== senha) return NextResponse.json({ ok: false }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, criarTokenAdmin(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/",
  });
  return response;
}
