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
Há testes que falham se alguém religar os dois módulos.

## Status da cotação

| Status | Significado |
| --- | --- |
| `OFFICIAL` | veio de uma tabela oficial da Magna |
| `ESTIMATED` | veio de regra inferida a partir de cotações de referência |
| `UNAVAILABLE` | não há regra aplicável para o veículo/plano consultado |

**Hoje o sistema opera 100% em `ESTIMATED`**, através do `EstimatedPricingProvider`.
A interface exibe _"Simulação estimada. Valores sujeitos à confirmação."_ e o
status viaja junto com o lead (campo `statusPrecificacao`).

### Como migrar para OFFICIAL

1. Implemente um provedor que satisfaça `PricingProvider` (`src/lib/pricing/types.ts`)
   com `status = "OFFICIAL"`.
2. Troque a instância exportada em `src/lib/pricing/index.ts`.

Nada mais na aplicação precisa mudar.

## Estrutura da mensalidade

As cotações reais **não** seguem um percentual puro da FIPE. A estrutura
observada é uma base que cresce linearmente com a FIPE mais um adicional fixo
por plano:

```
mensalidade = base + adicionalDoPlano
base        = valorFixo + valorFipe * fatorFipe
```

Adicionais por plano (iguais em carro e moto nas cotações conhecidas):

| Plano | Adicional |
| --- | --- |
| Bronze | + R$ 16,14 |
| Prata | + R$ 40,94 |
| Ouro | + R$ 72,34 |
| Premium | + R$ 85,84 |

### Carro

```
base = 52,25 + FIPE * 0,001395
```

Cotações reais usadas no ajuste (todas reproduzidas nos testes):

| Veículo | FIPE | Bronze | Prata | Ouro | Premium |
| --- | --- | --- | --- | --- | --- |
| Gol 2013 | R$ 28.436 | 108,07 | 132,87 | 164,27 | 177,77 |
| HB20 Premium 2013 | R$ 46.540 | 133,25 | 158,05 | 189,45 | 202,95 |
| Prisma LTZ 1.4 2015 | R$ 51.630 | 140,46 | 165,26 | 196,66 | 210,16 |

Divergência máxima da regra contra essas cotações: **R$ 0,06**.

### Moto

```
base        = 33,10 + FIPE * 0,002736
mensalidade = max(80,00, base + adicionalDoPlano)
```

Cotações reais usadas no ajuste:

| Veículo | Código FIPE | FIPE | Bronze | Prata |
| --- | --- | --- | --- | --- |
| Honda XRE 190 Flex 2025 | 811141-3 | R$ 25.197 | 118,19 | 142,98 |
| Honda CG 150 Fan ESi 2013 | 811101-4 | R$ 11.112 | 80,00 | 104,44 |

Divergência máxima: **R$ 0,01**. A mensalidade mínima observada é R$ 80,00.

## Planos oferecidos por categoria

`PricingProvider.getAvailablePlanIds(categoria)` é a única fonte dessa
informação. Interface, comparação, recomendador e precificação a respeitam.

| Categoria | Planos | Observação |
| --- | --- | --- |
| `CAR` | Bronze, Prata, Ouro, Premium | — |
| `MOTORCYCLE` | Bronze, Prata | Não há dados que confirmem Ouro/Premium para moto |
| `TRUCK` | nenhum | `UNAVAILABLE`: a interface encaminha a um consultor |

O plano recomendado pertence obrigatoriamente a essa lista. Se o perfil apontar
para algo acima do disponível (perfil exigente numa moto, por exemplo), o
recomendador entrega **Prata** e marca `limitadoPelaCategoria`, informando que é
a opção mais completa disponível para aquele veículo.

## Participação

Piso mínimo contratual: **R$ 1.800,00** (`NEXT_PUBLIC_PARTICIPACAO_MINIMA`).

| Modalidade | Carro | Moto | Multiplicador da mensalidade |
| --- | --- | --- | --- |
| Padrão | 12% | 15% | 1 |
| Reduzida | 8% | 12,5% | ≈ 1,05556 |
| Mínima | 6% | 10% | ≈ 1,11111 |
| Participação zero | R$ 0 no 1º evento | R$ 0 no 1º evento | ≈ 1,33333 |

A modalidade de participação zero tem carência de 60 dias.

### `hideDominatedParticipationOptions`

Em veículos de FIPE baixa as modalidades percentuais podem cair todas no piso —
o usuário veria a mesma participação por mensalidades diferentes. Isso **não** é
regra comercial definitiva, é configuração:

- `false` (**padrão**): exibe todas as modalidades, conforme a regra da Magna.
- `true`: oculta as opções economicamente dominadas.

## Taxa de adesão

```
adesao = max(300, mensalidade da modalidade escolhida)
```

Usa a mensalidade **final** da modalidade selecionada, não a mensalidade base do
plano. Exemplos: mensalidade R$ 164,27 → adesão R$ 300,00; mensalidade R$ 420,00
→ adesão R$ 420,00. O piso é configurável em `NEXT_PUBLIC_TAXA_ADESAO_MINIMA`.

## Uso comercial (aplicativo / táxi)

O uso comercial **não influencia o plano recomendado**. O motor de recomendação
recebe `Omit<PerfilRespostas, "finalidade">` — o compilador impede que a
finalidade entre nessa decisão.

O uso comercial afeta:

- **Mensalidade**: agravo de `1.1666667` (`NEXT_PUBLIC_FATOR_USO_COMERCIAL`),
  inferido da única cotação comercial conhecida — Prisma LTZ 1.4 2015
  (FIPE R$ 51.630): Bronze R$ 163,88 · Prata R$ 192,80 · Ouro R$ 229,44 ·
  Premium R$ 245,19. Continua `ESTIMATED`.
- **Modalidades disponíveis**: só a **Padrão** fica disponível para carro de
  aplicativo/táxi, conforme a regra observada no CRM
  (`NEXT_PUBLIC_PARTICIPACOES_BLOQUEADAS_USO_COMERCIAL`).

Moto nunca é perguntada sobre aplicativo/táxi: a finalidade é sempre particular
(`exigeUsoParticular` em `src/lib/types.ts`).

## Coberturas

O Bronze **não** cobre incêndio, explosão e fenômenos da natureza, nem colisão e
capotamento. Ele cobre roubo e furto, perda total, reboque, pane elétrica /
mecânica / seca e assistência 24h com guincho até 250 km. Incêndio, explosão e
fenômenos da natureza aparecem a partir do **Prata** nas propostas de referência.
