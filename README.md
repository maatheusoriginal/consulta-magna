# Consulta Magna — Consultor Digital de Proteção Veicular

Wizard de cotação de proteção veicular construído a partir do `DESIGN.md` do projeto:
o usuário identifica o veículo, responde cinco perguntas de perfil, recebe um plano
recomendado, compara as quatro opções, escolhe a participação e continua o
atendimento pelo WhatsApp.

**Os valores da tabela FIPE são consultados em tempo real por APIs públicas e
gratuitas — nenhuma chave de API é necessária para o site funcionar.**

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS 3 com os tokens do `DESIGN.md` (cores, raios, sombras, espaçamentos)
- Ícones outline do [lucide-react](https://lucide.dev)
- Sem banco de dados: o estado da cotação vive no `sessionStorage` do navegador

## Como rodar

```bash
npm install
cp .env.example .env.local   # ajuste o número do WhatsApp
npm run dev                  # http://localhost:3000
```

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`.

## Configuração

A única variável realmente necessária é o número do consultor:

```bash
NEXT_PUBLIC_WHATSAPP_NUMERO=5511999999999   # 55 + DDD + número, só dígitos
```

Todas as demais são opcionais e estão documentadas em `.env.example`.

### Tabela FIPE (grátis, sem chave)

| Fonte | Uso |
| --- | --- |
| [Parallelum FIPE API](https://deividfortuna.github.io/fipe/) | fonte primária de marcas, modelos, anos e preço |
| [BrasilAPI](https://brasilapi.com.br/docs#tag/FIPE) | contingência automática para marcas e modelos |

As respostas ficam em cache por 6 horas na memória do processo e por 24 horas no
cache de dados do Next, já que a tabela FIPE muda uma vez por mês.

Rotas expostas pelo servidor (`src/app/api`):

```
GET /api/fipe/marcas?tipo=carros|motos|caminhoes
GET /api/fipe/modelos?tipo=&marca=
GET /api/fipe/anos?tipo=&marca=&modelo=
GET /api/fipe/preco?tipo=&marca=&modelo=&ano=
GET /api/placa?placa=ABC1D23
POST /api/lead
```

### Consulta por placa (opcional)

Não existe API pública **e gratuita** de consulta por placa — os dados do Denatran
são restritos. Por isso a consulta por placa é um adaptador com provedores opcionais:

- `PLACA_API_TOKEN` — usa a [Invertexto](https://api.invertexto.com), que tem plano gratuito com token;
- `PLACA_API_URL` — qualquer outro provedor; use `{placa}` como marcador e, se
  precisar, `PLACA_API_AUTH_HEADER` / `PLACA_API_AUTH_VALUE`.

**Sem nenhuma dessas variáveis o site continua 100% funcional**: ao consultar uma
placa, a interface avisa e leva o usuário para a busca por marca/modelo/ano, que usa
apenas a API gratuita da FIPE. Quando um provedor está configurado, os dados da placa
são casados automaticamente com os códigos da FIPE.

### Leads

`POST /api/lead` valida nome, WhatsApp e e-mail. Sem configuração, o lead vai para o
log do servidor; com `LEAD_WEBHOOK_URL` definida, é encaminhado para Make, Zapier, n8n
ou um CRM próprio. Uma falha no webhook nunca bloqueia o atendimento.

## Precificação

Toda a regra de negócio está em `src/lib/planos.ts` e `src/lib/recomendacao.ts`.

- A mensalidade de cada plano é um percentual da FIPE do veículo, com piso mínimo.
  As taxas estão calibradas para reproduzir a tabela de referência do projeto
  (FIPE R$ 28.436,00 → Bronze R$ 108,07 · Prata R$ 132,87 · Ouro R$ 164,27 · Premium R$ 177,77).
- A participação é um percentual da FIPE (12%, 8% ou 6%), com piso contratual de
  R$ 1.800,00, e cada modalidade aplica um multiplicador sobre a mensalidade.
  A modalidade "participação zero" tem carência de 60 dias.
- Em veículos de FIPE baixa, várias faixas caem no mesmo piso. Nesse caso as opções
  dominadas (mesma participação por mensalidade maior) são removidas da lista.
- A taxa de adesão é um valor único de R$ 300,00, sempre apresentado separado da
  participação.

A recomendação de plano vem de uma pontuação das respostas do questionário, com
pisos por resposta (quem diz que carro reserva é muito importante nunca recebe um
plano sem carro reserva) e três justificativas exibidas ao usuário.

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
    fipe.ts               cliente das APIs de FIPE com contingência
    placa.ts              adaptador de consulta por placa
    planos.ts             catálogo de planos e motor de preços
    recomendacao.ts       motor de recomendação
    wizard.tsx            estado do wizard (contexto + sessionStorage)
```

## Deploy

O projeto é um app Next.js padrão e roda em qualquer host com suporte a Node 20+.
Na Vercel, basta importar o repositório e definir `NEXT_PUBLIC_WHATSAPP_NUMERO`
(e as opcionais) nas variáveis de ambiente do projeto.
