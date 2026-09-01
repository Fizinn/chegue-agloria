# Sete a Zero

## Ajustes desta versão

- **Box Score dinâmico:** mostra overall médio do ataque (MEI + ATA) e da defesa (GOL + DEF) enquanto o time é montado.
- **Almanaque:** durante o draft, os overalls continuam ocultos como `?`; ao completar o time, o resumo final revela ataque e defesa.
- **Solo:** agora começa na **Fase de Grupos (3 partidas)** e, se classificar, segue para **16 avos → Oitavas → Quartas → Semifinal → Final**.
- **Multiplayer:** mantém o mata-mata atual, começando nas oitavas.
- **Tema escuro:** corrigida a hidratação do Next.js e aumentada a legibilidade das posições dentro do campo.
- **Base de seleções:** o importador aceita somente os 22 Mundiais masculinos de 1930–2022 e adiciona separadamente a Copa de 2026. Isso evita Copas inexistentes, torneios femininos e seleções que não aparecem em uma Copa real.
- **Admin de overall:** botão discreto no canto inferior direito; os valores são ligados por `ano + ID do jogador`.
- **Supabase:** os overalls podem ser persistidos no banco e compartilhados entre dispositivos. Se o Supabase não estiver configurado, o navegador continua como fallback.

## Dados das Copas

O histórico 1930–2022 usa o Fjelstul World Cup Database. A fonte cobre os 22 Mundiais masculinos de 1930–2022 e também possui dados femininos; por isso o importador deste projeto filtra explicitamente apenas os anos masculinos válidos e equipes masculinas.

Para 2026, o importador usa a tabela pública de 48 seleções e 1.248 jogadores do dataset `FIFA-World-Cup-2026-Dataset`.

### Importar / atualizar elencos

```bash
npm install
npm run import:squads
npm run validate:squads
npm run dev
```

O comando `import:squads` precisa de internet e gera:

```text
public/data/squads-full.json
```

Se `npm run validate:squads` encontrar ano inválido, competição feminina ou elenco vazio, **não use o arquivo no jogo**; corrija a importação primeiro.

## Supabase — overalls persistentes

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Cole e execute `supabase/schema.sql`.
4. Copie `.env.example` para `.env.local`.
5. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=...
```

A `SUPABASE_SERVICE_ROLE_KEY` é **secreta** e deve ficar somente no servidor. Nunca coloque essa chave em componente React ou em variável `NEXT_PUBLIC_*`.

Depois reinicie o Next.js:

```bash
npm run dev
```

### Admin

Abra o ⚙️ no canto inferior direito e entre com o PIN definido em `ADMIN_PASSWORD`.

Cada alteração salva:

```text
Copa + ID do jogador + overall
```

Se o Supabase estiver configurado, a alteração vai para o banco e poderá ser carregada em outro dispositivo. Sem Supabase, ela fica no `localStorage` como fallback.

## Observação sobre a lista manual antiga

`src/lib/overallManual.ts` continua no projeto como **fallback**. Isso preserva a lista grande de overalls que já foi construída. O painel Admin tem prioridade quando existir um override salvo por ID.

Conforme você for corrigindo jogadores pelo painel, o valor passa a ficar associado ao jogador real, sem depender de nome completo, apelido ou acentuação.

## Multiplayer — lobby persistente

O multiplayer usa as tabelas `salas` e `sala_jogadores` como fonte persistente dos
jogadores e das configurações do lobby. O Supabase Realtime é usado para presença
e atualização imediata da lista, sem depender de refresh da página.

Para uma instalação nova ou para conferir a configuração do banco, execute também:

```text
supabase/multiplayer.sql
```

O fluxo é: entrar na sala → configurar nome, formação e estilo → `ESTOU PRONTO` →
todos prontos → somente o host pode usar `COMEÇAR PARTIDA`.


## Overall Manual definitivo

O jogo não usa mais `overallManual.ts` como fonte de runtime. Esse arquivo de 1.069 entradas é preservado apenas como **fonte de importação legada**.

A fonte prioritária é a tabela `public.overall_overrides` do Supabase:

- `year` = Copa;
- `player_id` = ID estável da fonte do jogador;
- `overall` = nota manual;
- `updated_at` = última alteração.

A chave lógica é `(year, player_id)`. O nome é somente um rótulo de exibição.

### Importar a lista existente

1. Rode `npm run import:squads` se `public/data/squads-full.json` ainda não existir.
2. Rode `npm run import:overalls`.
3. Confira `data/overall-manual-report.md`.
4. Somente as correspondências seguras entram em `data/overall-manual-resolved.json` e no seed SQL.
5. Para gravar no Supabase, configure `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` e rode `npm run apply:overalls`.

Entradas ambíguas ou sem correspondência **não são importadas**. Elas ficam disponíveis no painel Admin para associação manual por ID.

### CSV

O formato recomendado é:

```csv
year,player_id,overall
2026,P26-946,99
2026,P26-218,95
```

Também é possível importar `year,player_name,overall`, mas o importador só aceita nomes quando existe uma única correspondência segura. Para qualquer dúvida, use `player_id`.

### Prioridade do jogo

`overallDoJogador()` executa:

1. procura `(year, player_id)` no cache carregado do Supabase;
2. se encontrar, retorna o Overall Manual;
3. se não encontrar, executa a fórmula automática existente.

Assim, atualizar o cálculo automático não apaga nem sobrescreve os Overalls salvos no banco.
