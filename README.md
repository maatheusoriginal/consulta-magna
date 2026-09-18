# Consulta Magna — Consultor Digital de Proteção Veicular

Wizard de cotação de proteção veicular construído a partir do `DESIGN.md` do
projeto: o usuário identifica o veículo, responde cinco perguntas de perfil,
recebe um plano recomendado, compara as quatro opções, escolhe a participação e
continua o atendimento pelo WhatsApp.

Os dados da tabela FIPE são consultados em tempo real por APIs públicas e
gratuitas — nenhuma chave de API é necessária para o site funcionar.

> **Aviso de precificação.** A mensalidade **não** vem da FIPE nem de uma tabela
> oficial da Magna. Ela é calculada por uma regra inferida a partir de cotações
> reais de referência (três de carro e duas de moto), e por isso toda cotação sai
> com status `ESTIMATED` e a interface avisa:
> _"Simulação estimada. Valores sujeitos à confirmação."_
> Fórmulas, cotações de referência, planos por categoria e caminho de migração em
> [`docs/PRECIFICACAO.md`](docs/PRECIFICACAO.md).

### Resumo das regras de negócio

- Mensalidade = base linear na FIPE + adicional fixo por plano (fórmula distinta
  para carro e para moto).
- Planos por categoria: carro tem os quatro; **moto só tem Bronze e Prata**;
  caminhão não tem oferta e cai em `UNAVAILABLE`.
- Participação: carro 12% / 8% / 6% / zero; **moto 15% / 12,5% / 10% / zero**;
  piso contratual de R$ 1.800,00 nas duas.
- Adesão = `max(R$ 300, mensalidade da modalidade escolhida)`.
- Carro de aplicativo/táxi: agravo na mensalidade e **somente a participação
  Padrão** disponível. Moto não é perguntada sobre aplicativo/táxi.
- Bronze **não** cobre incêndio/fenômenos da natureza nem colisão.

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS 3 com os tokens do `DESIGN.md` (cores, raios, sombras, espaçamentos)
- Ícones outline do [lucide-react](https://lucide.dev)
- [Vitest](https://vitest.dev) para os testes
- Sem banco de dados: o estado da cotação vive no `sessionStorage` do navegador

## Como rodar

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run start` | serve o build |
| `npm test` | suíte de testes (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Configuração

Todas as variáveis estão documentadas em `.env.example`.

| Variável | Obrigatória | Padrão |
| --- | --- | --- |
| `NEXT_PUBLIC_WHATSAPP_NUMERO` | recomendada | `5534991960908` |
| `LEAD_WEBHOOK_URL` | **sim, em produção** | — |
| `FIPE_API_URL` | não | Parallelum |
| `PLACA_API_TOKEN` / `PLACA_API_URL` | não | — |
| `NEXT_PUBLIC_TAXA_ADESAO_MINIMA` | não | `300` |
| `NEXT_PUBLIC_PARTICIPACAO_MINIMA` | não | `1800` |
| `NEXT_PUBLIC_HIDE_DOMINATED_PARTICIPATION_OPTIONS` | não | `false` |
| `NEXT_PUBLIC_FATOR_USO_COMERCIAL` | não | `1.1666667` |
| `NEXT_PUBLIC_PARTICIPACOES_BLOQUEADAS_USO_COMERCIAL` | não | `reduzida,minima,zero` |

### Tabela FIPE (grátis, sem chave)

| Consulta | Fonte primária | Contingência |
| --- | --- | --- |
| Marcas | Parallelum | BrasilAPI |
| Modelos | Parallelum | BrasilAPI |
| Anos | Parallelum | **nenhuma** |
| Valor FIPE | Parallelum | **nenhuma** |

A contingência da [BrasilAPI](https://brasilapi.com.br/docs#tag/FIPE) cobre
**apenas marcas e modelos**. Anos e valor FIPE dependem exclusivamente da
[Parallelum](https://deividfortuna.github.io/fipe/): se ela falhar nessas duas
consultas, a interface mostra um erro e permite tentar de novo. Não há
contingência total da FIPE.

As respostas ficam em cache por 6 horas na memória do processo e por 24 horas no
cache de dados do Next, já que a tabela FIPE muda uma vez por mês.

A FIPE fornece **apenas**: marca, modelo, ano, combustível, código FIPE, valor
FIPE e mês de referência. Ela nunca é usada como fonte da mensalidade.

```
GET  /api/fipe/marcas?tipo=carros|motos|caminhoes
GET  /api/fipe/modelos?tipo=&marca=
GET  /api/fipe/anos?tipo=&marca=&modelo=
GET  /api/fipe/preco?tipo=&marca=&modelo=&ano=
GET  /api/placa?placa=ABC1D23
POST /api/lead
```

### Consulta por placa (opcional)

Não existe API pública **e gratuita** de consulta por placa — os dados do
Denatran são restritos. A consulta por placa é um adaptador com provedores
opcionais:

- `PLACA_API_TOKEN` — usa a [Invertexto](https://api.invertexto.com), que tem plano gratuito com token;
- `PLACA_API_URL` — qualquer outro provedor; use `{placa}` como marcador e, se
  precisar, `PLACA_API_AUTH_HEADER` / `PLACA_API_AUTH_VALUE`.

**Sem nenhuma dessas variáveis o site continua funcional**: ao consultar uma
placa, a interface avisa e leva o usuário para a busca por marca/modelo/ano, que
usa apenas a API gratuita da FIPE.

Com um provedor configurado, a correspondência entre o texto devolvido pela placa
e as versões da FIPE é **aproximada**, então a aplicação **nunca escolhe a versão
sozinha**: ela lista as versões compatíveis — com modelo, ano, combustível,
código e valor FIPE — e o usuário confirma qual é a sua.

### Persistência de leads

`src/lib/leads` define a interface `LeadRepository` com duas implementações:

| Implementação | Quando é usada | `persistido` |
| --- | --- | --- |
| `WebhookLeadRepository` | há `LEAD_WEBHOOK_URL` | `true` |
| `ConsoleLeadRepository` | não há `LEAD_WEBHOOK_URL` | `false` |

Log de servidor **não é persistência de produção**. O `ConsoleLeadRepository`
grava apenas um resumo sem dados pessoais (telefone mascarado, sem nome, e-mail
ou placa) e devolve `persistido: false` — o lead nunca é anunciado como salvo.

Em produção sem `LEAD_WEBHOOK_URL`, um aviso explícito é emitido no build
(`next.config.ts`) e no startup (`criarLeadRepository`).

O lead persistido é o snapshot completo da cotação: contato, veículo, dados da
FIPE, tipo de uso, respostas do questionário, plano recomendado, plano escolhido,
mensalidade, participação, adesão, status da precificação, data/hora e código da
simulação.

## Fluxo de captura do lead

1. valida nome e telefone (e-mail, se informado);
2. monta o snapshot definitivo da cotação;
3. persiste o lead — em caso de falha, o usuário vê o erro e o fluxo **não** avança;
4. só então a tela final libera o link do WhatsApp.

O botão final é um único `<a href target="_blank" rel="noopener noreferrer">`,
sem `window.open`, e a mensagem é montada a partir do snapshot — nenhum veículo,
valor FIPE, plano ou preço fixo no código.

## Estrutura

```
src/
  app/
    page.tsx              landing (hero, como funciona, planos, dúvidas)
    cotacao/page.tsx      wizard
    api/                  rotas FIPE, placa e lead
  components/
    wizard/               as sete telas do wizard
    ...                   componentes compartilhados
  lib/
    fipe.ts               FipeProvider — só dados do veículo
    placa.ts              adaptador de consulta por placa
    planos.ts             catálogo de coberturas (sem preço)
    pricing/              PricingProvider, config e regra inferida
    leads/                LeadRepository e implementações
    recomendacao.ts       motor de recomendação (ignora a finalidade)
    cotacao.ts            snapshot definitivo da cotação
    whatsapp.ts           WhatsAppService
    wizard.tsx            estado do wizard (contexto + sessionStorage)
tests/                    suíte Vitest
docs/PRECIFICACAO.md      regra de preços, status e migração para OFFICIAL
```

## Deploy

App Next.js padrão, roda em qualquer host com Node 20+. Na Vercel, importe o
repositório e defina ao menos `NEXT_PUBLIC_WHATSAPP_NUMERO` e `LEAD_WEBHOOK_URL`
nas variáveis de ambiente do projeto.
