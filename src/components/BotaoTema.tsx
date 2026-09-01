"use client";

import { useEffect, useState } from "react";

export function BotaoTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem("tema", novo ? "escuro" : "claro");
    } catch {
      // localStorage indisponível — sem problema, só não persiste
    }
  }

  return (
    <button
      onClick={alternar}
      title={escuro ? "Mudar pro modo claro" : "Mudar pro modo escuro"}
      className="rounded-lg border border-ink/10 bg-card px-3 py-1.5 text-sm text-ink/70 shadow-card transition hover:border-ink/30"
    >
      {escuro ? "☀️ Claro" : "🌙 Escuro"}
    </button>
  );
}
