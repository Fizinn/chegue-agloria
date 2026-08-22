import Link from "next/link";
import { BotaoTema } from "@/components/BotaoTema";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="fixed right-4 top-4">
        <BotaoTema />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          monte seu time · sorteie uma seleção · vença o mata-mata
        </p>
        <h1 className="font-display text-6xl font-semibold leading-none text-ink">
          Sete a Zero
        </h1>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/solo"
          className="rounded-card border border-ink/10 bg-card p-6 text-left shadow-card transition hover:-translate-y-0.5"
        >
          <h2 className="font-display text-2xl">Solo</h2>
          <p className="mt-1 text-sm text-ink/60">
            Monte seu time e enfrente seleções históricas simuladas.
          </p>
        </Link>
        <Link
          href="/room/create"
          className="rounded-card border border-ink/10 bg-card p-6 text-left shadow-card transition hover:-translate-y-0.5"
        >
          <h2 className="font-display text-2xl">Criar sala</h2>
          <p className="mt-1 text-sm text-ink/60">
            Configure e crie uma sala multiplayer pra jogar com outras pessoas.
          </p>
        </Link>
        <Link
          href="/room/join"
          className="rounded-card border border-ink/10 bg-card p-6 text-left shadow-card transition hover:-translate-y-0.5"
        >
          <h2 className="font-display text-2xl">Entrar em sala</h2>
          <p className="mt-1 text-sm text-ink/60">
            Já tem um código? Entre numa sala que alguém criou.
          </p>
        </Link>
      </div>
    </main>
  );
}
