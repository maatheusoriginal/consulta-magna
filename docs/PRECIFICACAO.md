# Precificação

> **Regra de mensalidade inferida a partir de cotações de referência.
> Deve ser substituída por fonte oficial quando disponível.**

## Separação de responsabilidades

Duas fontes de dados totalmente independentes, sem importação cruzada:

| Módulo | Responsabilidade | O que NÃO faz |
| --- | --- | --- |
| `src/lib/fipe.ts` (FipeProvider) | marca, modelo, ano, combustível, código FIPE, valor FIPE e mês de referência | não calcula mensalidade, participação nem adesão |
| `src/lib/pricing` (PricingProvider) | mensalidade, participação e adesão da Magna | não consulta a FIPE nem faz chamadas de rede |

A FIPE é a prova do **valor do veículo**, nunca a prova da **mensalidade da Magna**.
O `PricingProvider` recebe o valor FIPE já apurado e devolve apenas valores
comerciais. Há testes que falham se alguém religar os dois módulos.

## Status da cotação

Todo resultado de precificação carrega um status:

| Status | Significado |
| --- | --- |
| `OFFICIAL` | veio de uma tabela oficial da Magna |
| `ESTIMATED` | veio de regra inferida a partir de cotações de referência |
| `UNAVAILABLE` | não há regra aplicável para o veículo/plano consultado |

**Hoje o sistema opera 100% em `ESTIMATED`.** O provedor ativo é o
`EstimatedPricingProvider`. Enquanto for assim, a interface exibe
_"Simulação estimada. Valores sujeitos à confirmação."_ e o status viaja junto
com o lead (campo `statusPrecificacao`).

### Como migrar para OFFICIAL

1. Implemente um provedor que satisfaça a interface `PricingProvider`
   (`src/lib/pricing/types.ts`) com `status = "OFFICIAL"`.
2. Troque a instância exportada em `src/lib/pricing/index.ts`.

Nada mais na aplicação precisa mudar: telas, lead e mensagem do WhatsApp já leem
o status do resultado.

## Regra por categoria de veículo

A tabela de taxas é **por categoria**. A fórmula de carro nunca é aplicada
automaticamente a outra categoria — categoria sem tabela responde `UNAVAILABLE`.

| Categoria | Origem dos números | Status |
| --- | --- | --- |
| `CAR` | calibrada para reproduzir as cotações de referência conhecidas (FIPE R$ 28.436,00 → Bronze R$ 108,07 · Prata R$ 132,87 · Ouro R$ 164,27 · Premium R$ 177,77) | `ESTIMATED` |
| `MOTORCYCLE` | **provisória** — não há cotações de referência de moto; os números precisam ser substituídos pela tabela da Magna | `ESTIMATED` |
| `TRUCK` | sem tabela — caminhão exige análise individual | `UNAVAILABLE` (a interface encaminha a um consultor) |

## Participação

- Percentuais: 12% (Padrão), 8% (Reduzida), 6% (Mínima) e a modalidade
  Participação zero (carência de 60 dias).
- Piso mínimo contratual configurável (`NEXT_PUBLIC_PARTICIPACAO_MINIMA`,
  padrão R$ 1.800,00).
- Cada modalidade aplica um multiplicador sobre a mensalidade base do plano.

### `hideDominatedParticipationOptions`

Em veículos de FIPE baixa, 12%, 8% e 6% podem cair todos no piso mínimo — o
usuário veria a mesma participação por mensalidades diferentes.

Isso **não** é tratado como regra comercial definitiva. É configuração:

- `false` (**padrão**): exibe todas as modalidades, conforme a regra da Magna.
- `true`: oculta as opções economicamente dominadas.

Variável: `NEXT_PUBLIC_HIDE_DOMINATED_PARTICIPATION_OPTIONS`.

## Uso comercial (aplicativo / táxi)

O uso comercial **não influencia o plano recomendado**. O motor de recomendação
(`src/lib/recomendacao.ts`) recebe `Omit<PerfilRespostas, "finalidade">` — o
próprio compilador impede que a finalidade volte a entrar nessa decisão.

O uso comercial pode afetar:

- a **mensalidade**, via `NEXT_PUBLIC_FATOR_USO_COMERCIAL` (padrão `1`, neutro);
- as **modalidades de participação disponíveis**, via
  `NEXT_PUBLIC_PARTICIPACOES_BLOQUEADAS_USO_COMERCIAL` (padrão: nenhuma).

Ambos estão em `1`/vazio de propósito: a Magna precisa informar o agravo e as
restrições reais antes de ativá-los.

## Adesão

Valor único de filiação e ativação (`NEXT_PUBLIC_TAXA_ADESAO`, padrão R$ 300,00),
sempre apresentado em área separada da participação para não haver confusão.
