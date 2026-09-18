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
- Veículo sem precificação automática (caminhão) também captura lead: placa,
  nome e WhatsApp obrigatórios, snapshot com `statusPrecificacao: "UNAVAILABLE"`
  e todos os valores em `null` — nenhum R$ 0 apresentado como preço.
- Moto não é perguntada sobre aplicativo/táxi. Isso **não** significa uso
  particular: o lead grava `usoDeclarado: null` e a mensagem omite a seção USO.

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
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recomendada em produção | — |
| `NEXT_PUBLIC_PRIVACY_POLICY_URL` | não | — |
| `FIPE_API_URL` | não | Parallelum |
| `PLACA_API_URL` | não | — |
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
Denatran são restritos. Verificamos a documentação da
[Invertexto](https://api.invertexto.com/) (consultada em setembro de 2026): ela
oferece Tabela FIPE, CEP, CNPJ, feriados e outras APIs, mas **não** possui
consulta de placa. A integração específica que existia aqui foi removida por não
ser confirmável.

Resta a abstração genérica, para o provedor que você contratar:

```bash
PLACA_API_URL=https://api.exemplo.com/veiculo/{placa}
PLACA_API_AUTH_HEADER=Authorization
PLACA_API_AUTH_VALUE=Bearer seu_token
```

**Sem essas variáveis a consulta por placa não é simulada**: a interface avisa e
encaminha o cliente para a busca por marca/modelo/ano, que funciona apenas com a
API gratuita da FIPE.

Com um provedor configurado:

- Se ele devolver a **categoria** do veículo (`tipo`, `tipoVeiculo`, `categoria`,
  `especie`…), ela é normalizada para `carros`, `motos` ou `caminhoes`.
- Se **não** devolver, a aplicação **não assume carro**: pergunta ao cliente
  "Que tipo de veículo é?" antes de tocar na FIPE. Uma moto nunca é procurada na
  tabela de carros.
- A correspondência com as versões da FIPE é **aproximada**, então a aplicação
  **nunca escolhe a versão sozinha**: lista as versões compatíveis com modelo,
  ano, combustível, código e valor FIPE, e o cliente confirma.
- Um mesmo ano pode ter Gasolina, Flex e Diesel: **todas** as entradas são
  oferecidas. O combustível informado pela placa só prioriza a ordem da lista,
  nunca descarta opções.

### Persistência de leads

`src/lib/leads` define a interface `LeadRepository` com duas implementações:

| Implementação | Quando é usada | `persistido` |
| --- | --- | --- |
| `WebhookLeadRepository` | há `LEAD_WEBHOOK_URL` | `true` |
| `ConsoleLeadRepository` | não há `LEAD_WEBHOOK_URL` | `false` |

Log de servidor **não é persistência de produção**. O `ConsoleLeadRepository`
grava apenas um resumo sem dados pessoais (telefone mascarado, sem nome, e-mail
ou placa) e devolve `persistido: false` — o lead nunca é anunciado como salvo.

**Em produção, sem `LEAD_WEBHOOK_URL` a rota `POST /api/lead` responde `503`** e
o fluxo não avança até o WhatsApp — a promessa de "salvar o lead antes de abrir o
WhatsApp" não pode ser cumprida com um sucesso falso. Um aviso explícito também é
emitido no build (`next.config.ts`) e no startup (`criarLeadRepository`). Em
desenvolvimento o `ConsoleLeadRepository` continua funcionando normalmente.

O lead persistido é o snapshot completo da cotação: contato, **placa**, veículo,
dados da FIPE, uso declarado, respostas do questionário, plano recomendado, plano
escolhido, mensalidade, participação, adesão, status da precificação, data/hora,
`simulationId` (UUID técnico) e `codigo` (MG-XXXXX, amigável).

## Placa do veículo

A placa é uma das informações mais importantes para o consultor, então é
**obrigatória** para fechar a cotação.

- Quem começa **pela placa**: o valor é guardado no estado do wizard (fora do
  objeto do veículo) e sobrevive à consulta FIPE, à escolha de versão, a voltar
  etapas e a trocar de plano ou participação.
- Quem começa **pela busca manual**: a placa é pedida na tela de resumo, antes do
  envio do lead. Não há nova consulta de veículo — a placa serve para o registro.

Normalização e validação ficam centralizadas em `src/lib/format.ts`
(`normalizePlaca`, `isPlacaValida`, `formatPlaca`) — nenhum componente tem regex
de placa própria. `abc-1d23` e ` abc 1d23 ` viram `ABC1D23`; os padrões antigo
(ABC1234) e Mercosul (ABC1D23) são aceitos.

## Fluxo de captura do lead

1. valida nome, telefone, **placa** e **consentimento** (e-mail, se informado);
2. envia ao servidor apenas os **dados de entrada** — veículo, respostas do
   perfil e escolhas. Nenhum valor calculado no navegador é enviado como verdade;
3. o servidor recalcula tudo com o `PricingProvider` e monta o snapshot canônico;
4. persiste o lead — em caso de falha, o cliente vê o erro e o fluxo **não** avança;
5. a tela final e o WhatsApp usam o **snapshot devolvido pelo servidor**.

Detalhes e garantias em [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

O botão "Continuar pelo WhatsApp" só habilita com nome, telefone, placa,
consentimento, veículo, versão FIPE e plano válidos. O botão final é um único
`<a href target="_blank" rel="noopener noreferrer">`, sem `window.open`, e a
mensagem é montada a partir do snapshot — nenhum veículo, valor FIPE, plano ou
preço fixo no código. **A placa aparece logo no início da mensagem**, antes dos
dados do veículo.

## Estrutura

### Endurecimento de produção

- **O servidor é a fonte da cotação.** `POST /api/lead` revalida o veículo na
  FIPE pelos códigos e recalcula mensalidade, participação, adesão, plano
  recomendado e `statusPrecificacao`. Nem a identidade do veículo, nem o valor
  FIPE, nem o status podem ser escolhidos pelo cliente.
- **Sem confirmação não há cotação.** Códigos FIPE ausentes ou combinação
  inexistente → `422`; API da FIPE fora do ar → `503`, sem usar o valor do
  navegador como fallback e sem persistir o lead.
- **Rate limit** por IP em `/api/lead`, `/api/placa` e `/api/fipe/*`, com
  provider distribuído (Upstash/Vercel KV) e fallback em memória que **avisa**
  que não é global em serverless.
- **Consentimento** explícito, desmarcado por padrão, com link opcional para a
  Política de Privacidade.

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
    rate-limit/           RateLimitProvider (memória e Upstash)
    cotacao-servidor.ts   reconstrução e revalidação da cotação no servidor
    recomendacao.ts       motor de recomendação (ignora a finalidade)
    cotacao.ts            snapshot definitivo da cotação
    whatsapp.ts           WhatsAppService
    wizard.tsx            estado do wizard (contexto + sessionStorage)
tests/                    suíte Vitest
docs/PRECIFICACAO.md      regra de preços, status e migração para OFFICIAL
docs/SEGURANCA.md         endurecimento de produção (servidor, rate limit, consentimento)
```

## Deploy

App Next.js padrão, roda em qualquer host com Node 20+. Na Vercel, importe o
repositório e defina ao menos `NEXT_PUBLIC_WHATSAPP_NUMERO` e `LEAD_WEBHOOK_URL`
nas variáveis de ambiente do projeto.
