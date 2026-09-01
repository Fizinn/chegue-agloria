import crypto from "node:crypto";

const COOKIE_NAME = "sete-a-zero-admin";
const segredo = () => process.env.ADMIN_PASSWORD || "0707";

function assinatura(payload: string) {
  return crypto.createHmac("sha256", segredo()).update(payload).digest("hex");
}

export function criarTokenAdmin() {
  const payload = `${Date.now()}.${crypto.randomBytes(16).toString("hex")}`;
  return `${payload}.${assinatura(payload)}`;
}

export function validarTokenAdmin(token?: string | null) {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const payload = `${partes[0]}.${partes[1]}`;
  const recebido = partes[2];
  const esperado = assinatura(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) return false;
  } catch { return false; }
  const criado = Number(partes[0]);
  return Number.isFinite(criado) && Date.now() - criado < 1000 * 60 * 60 * 8;
}

export { COOKIE_NAME };
