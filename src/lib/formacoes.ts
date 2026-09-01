import { CATEGORIA_DO_SLOT, Posicao, PosicaoAmpla } from "@/types/game";

export type Formacao = "4-3-3" | "4-4-2" | "3-5-2" | "4-2-3-1" | "5-3-2" | "3-4-3";

export interface SlotFormacao {
  posicao: Posicao;
  slotKey: string;
  top: string;
  left: string;
}

export const FORMACOES: Record<Formacao, SlotFormacao[]> = {
  "4-3-3": [
    { posicao: "GOL", slotKey: "GOL-0", top: "92%", left: "50%" },
    { posicao: "LD", slotKey: "LD-0", top: "76%", left: "85%" },
    { posicao: "ZAG", slotKey: "ZAG-0", top: "78%", left: "63%" },
    { posicao: "ZAG", slotKey: "ZAG-1", top: "78%", left: "37%" },
    { posicao: "LE", slotKey: "LE-0", top: "76%", left: "15%" },
    { posicao: "VOL", slotKey: "VOL-0", top: "55%", left: "50%" },
    { posicao: "MC", slotKey: "MC-0", top: "45%", left: "30%" },
    { posicao: "MC", slotKey: "MC-1", top: "45%", left: "70%" },
    { posicao: "CA", slotKey: "CA-0", top: "15%", left: "20%" },
    { posicao: "CA", slotKey: "CA-1", top: "10%", left: "50%" },
    { posicao: "CA", slotKey: "CA-2", top: "15%", left: "80%" },
  ],
  "4-4-2": [
    { posicao: "GOL", slotKey: "GOL-0", top: "92%", left: "50%" },
    { posicao: "LD", slotKey: "LD-0", top: "76%", left: "85%" },
    { posicao: "ZAG", slotKey: "ZAG-0", top: "78%", left: "63%" },
    { posicao: "ZAG", slotKey: "ZAG-1", top: "78%", left: "37%" },
    { posicao: "LE", slotKey: "LE-0", top: "76%", left: "15%" },
    { posicao: "MC", slotKey: "MC-0", top: "50%", left: "12%" },
    { posicao: "VOL", slotKey: "VOL-0", top: "52%", left: "37%" },
    { posicao: "VOL", slotKey: "VOL-1", top: "52%", left: "63%" },
    { posicao: "MC", slotKey: "MC-1", top: "50%", left: "88%" },
    { posicao: "CA", slotKey: "CA-0", top: "15%", left: "35%" },
    { posicao: "CA", slotKey: "CA-1", top: "15%", left: "65%" },
  ],
  "3-5-2": [
    { posicao: "GOL", slotKey: "GOL-0", top: "92%", left: "50%" },
    { posicao: "ZAG", slotKey: "ZAG-0", top: "80%", left: "30%" },
    { posicao: "ZAG", slotKey: "ZAG-1", top: "82%", left: "50%" },
    { posicao: "ZAG", slotKey: "ZAG-2", top: "80%", left: "70%" },
    { posicao: "MC", slotKey: "MC-0", top: "58%", left: "10%" },
    { posicao: "VOL", slotKey: "VOL-0", top: "52%", left: "37%" },
    { posicao: "VOL", slotKey: "VOL-1", top: "52%", left: "63%" },
    { posicao: "MC", slotKey: "MC-1", top: "58%", left: "90%" },
    { posicao: "MEI", slotKey: "MEI-0", top: "35%", left: "50%" },
    { posicao: "CA", slotKey: "CA-0", top: "15%", left: "35%" },
    { posicao: "CA", slotKey: "CA-1", top: "15%", left: "65%" },
  ],
  "4-2-3-1": [
    { posicao: "GOL", slotKey: "GOL-0", top: "92%", left: "50%" },
    { posicao: "LD", slotKey: "LD-0", top: "76%", left: "85%" },
    { posicao: "ZAG", slotKey: "ZAG-0", top: "78%", left: "63%" },
    { posicao: "ZAG", slotKey: "ZAG-1", top: "78%", left: "37%" },
    { posicao: "LE", slotKey: "LE-0", top: "76%", left: "15%" },
    { posicao: "VOL", slotKey: "VOL-0", top: "58%", left: "37%" },
    { posicao: "VOL", slotKey: "VOL-1", top: "58%", left: "63%" },
    { posicao: "MC", slotKey: "MC-0", top: "38%", left: "20%" },
    { posicao: "MEI", slotKey: "MEI-0", top: "32%", left: "50%" },
    { posicao: "MC", slotKey: "MC-1", top: "38%", left: "80%" },
    { posicao: "CA", slotKey: "CA-0", top: "12%", left: "50%" },
  ],
  "5-3-2": [
    { posicao: "GOL", slotKey: "GOL-0", top: "92%", left: "50%" },
    { posicao: "LD", slotKey: "LD-0", top: "74%", left: "90%" },
    { posicao: "ZAG", slotKey: "ZAG-0", top: "78%", left: "68%" },
    { posicao: "ZAG", slotKey: "ZAG-1", top: "80%", left: "50%" },
    { posicao: "ZAG", slotKey: "ZAG-2", top: "78%", left: "32%" },
    { posicao: "LE", slotKey: "LE-0", top: "74%", left: "10%" },
    { posicao: "VOL", slotKey: "VOL-0", top: "52%", left: "50%" },
    { posicao: "MC", slotKey: "MC-0", top: "45%", left: "30%" },
    { posicao: "MC", slotKey: "MC-1", top: "45%", left: "70%" },
    { posicao: "CA", slotKey: "CA-0", top: "15%", left: "35%" },
    { posicao: "CA", slotKey: "CA-1", top: "15%", left: "65%" },
  ],
  "3-4-3": [
    { posicao: "GOL", slotKey: "GOL-0", top: "92%", left: "50%" },
    { posicao: "ZAG", slotKey: "ZAG-0", top: "80%", left: "30%" },
    { posicao: "ZAG", slotKey: "ZAG-1", top: "82%", left: "50%" },
    { posicao: "ZAG", slotKey: "ZAG-2", top: "80%", left: "70%" },
    { posicao: "MC", slotKey: "MC-0", top: "55%", left: "12%" },
    { posicao: "VOL", slotKey: "VOL-0", top: "50%", left: "37%" },
    { posicao: "VOL", slotKey: "VOL-1", top: "50%", left: "63%" },
    { posicao: "MC", slotKey: "MC-1", top: "55%", left: "88%" },
    { posicao: "CA", slotKey: "CA-0", top: "15%", left: "20%" },
    { posicao: "CA", slotKey: "CA-1", top: "10%", left: "50%" },
    { posicao: "CA", slotKey: "CA-2", top: "15%", left: "80%" },
  ],
};

export const NOMES_FORMACAO: Record<Formacao, string> = {
  "4-3-3": "4-3-3 (equilibrada, com pontas)",
  "4-4-2": "4-4-2 (clássica, dois de linha)",
  "3-5-2": "3-5-2 (meio-campo forte, alas)",
  "4-2-3-1": "4-2-3-1 (moderna, meia-armador central)",
  "5-3-2": "5-3-2 (retranca, cinco na defesa)",
  "3-4-3": "3-4-3 (ofensiva, três atacantes)",
};

export function capacidadeTitularFormacao(
  formacao: Formacao,
): Record<PosicaoAmpla, number> {
  const contagem: Record<PosicaoAmpla, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
  FORMACOES[formacao].forEach((slot) => {
    contagem[CATEGORIA_DO_SLOT[slot.posicao]]++;
  });
  return contagem;
}
