import type { Metadata } from "next";
import "./globals.css";
import { OverallOverridesProvider } from "@/components/OverallOverridesProvider";
import { AdminOverallButton } from "@/components/AdminOverallButton";

export const metadata: Metadata = {
  title: "Chegue a Glória",
  description: "Monte seu time, sorteie uma seleção e dispute o mata-mata.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          // roda antes da página pintar, pra já aplicar o tema salvo sem
          // piscar a cor errada por uma fração de segundo
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var tema = localStorage.getItem('tema');
                if (tema === 'escuro' || (!tema && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-body antialiased">
        <OverallOverridesProvider>{children}</OverallOverridesProvider>
        <AdminOverallButton />
      </body>
    </html>
  );
}
