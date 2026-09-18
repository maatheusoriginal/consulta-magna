# Endurecimento de produção

A aplicação é pública: qualquer pessoa pode montar uma requisição à mão. Este
documento descreve o que o servidor garante independentemente do navegador.

## O servidor é a fonte da cotação

`POST /api/lead` **não aceita valores calculados no cliente**. O navegador envia
apenas dados de entrada:

```jsonc
{
  "nome": "...", "whatsapp": "...", "email": "...",
  "placa": "ABC1D23",
  "consentimento": true,
  "veiculo": { "tipo", "marca", "modelo", "anoModelo", "combustivel",
               "codigoFipe", "valor", "mesReferencia",
               "marcaCodigo", "modeloCodigo", "anoCodigo" },
  "perfil": { "finalidade", "prioridade", "viagens",
              "carroReserva", "terceiros", "vidros" },   // null quando não se aplica
  "planoEscolhido": "bronze",                            // null quando não se aplica
  "participacaoId": "padrao"                             // null quando não se aplica
}
```

`src/lib/cotacao-servidor.ts` então, nessa ordem:

1. valida contato, placa e **consentimento**;
2. **revalida o veículo na tabela FIPE** a partir de `tipo + marcaCodigo +
   modeloCodigo + anoCodigo`, e passa a usar exclusivamente a identidade
   devolvida pela API (ver abaixo);
3. determina a categoria a partir do tipo confirmado;
4. obtém os planos da categoria com `getAvailablePlanIds()`;
5. rejeita plano não oferecido para a categoria (`422`);
6. deriva o uso comercial do perfil — e o ignora onde a finalidade não é
   perguntada, para que ninguém force uso comercial numa moto;
7. recalcula com o `PricingProvider`;
8. rejeita modalidade de participação indisponível para aquele uso (`422`);
9. recalcula mensalidade, participação e adesão;
10. define `statusPrecificacao` pelo provider;
11. recalcula o plano recomendado;
12. gera `simulationId` e `codigo` no servidor.

Qualquer campo de valor que venha no corpo é simplesmente descartado. Enviar
`mensalidade: 1`, `statusPrecificacao: "OFFICIAL"` ou `planoRecomendado:
"premium"` não muda nada.

## A FIPE também é server-authoritative

O navegador manda marca, modelo, ano, combustível, código e valor FIPE apenas
para a interface. **Nada disso é aceito como verdade.** O servidor reconsulta a
tabela com `consultarPreco(tipo, marcaCodigo, modeloCodigo, anoCodigo)` de
`src/lib/fipe.ts` — a mesma integração usada pelo resto do app, sem duplicação —
e a resposta vira a identidade canônica do veículo para precificação, snapshot,
lead, webhook e WhatsApp.

| Situação | Resposta |
| --- | --- |
| Códigos ausentes (`marcaCodigo`, `modeloCodigo` ou `anoCodigo`) | `422` — "Não foi possível confirmar os dados FIPE deste veículo. Volte e selecione o veículo novamente." |
| Combinação inexistente na tabela (inclui código de carro enviado como moto) | `422`, mesma mensagem |
| API da FIPE indisponível | `503` — "Não foi possível confirmar o valor FIPE agora. Tente novamente em alguns instantes." |

Regras importantes:

- **O tipo faz parte da consulta.** Um código de carro enviado como `motos`
  simplesmente não existe na tabela de motos e é rejeitado. Nunca há fallback
  para outro tipo.
- **Indisponibilidade nunca vira fallback.** Se a FIPE não responde, o valor do
  navegador não é usado, nenhum preço é inventado, o lead não é persistido e o
  WhatsApp não é liberado.
- **Caminhão também é revalidado.** A identidade vem da FIPE, mas o resultado
  continua `UNAVAILABLE` com todos os valores em `null` — a revalidação não cria
  preço para categoria sem regra.
- `consultarPreco` já tem cache (6h em memória, 24h no cache do Next), então o
  veículo recém-selecionado responde do cache e a revalidação não multiplica
  chamadas externas.

### Snapshot canônico

O snapshot construído no servidor é o que vai para o `LeadRepository` **e** o
que volta na resposta:

```json
{ "ok": true, "persistido": true, "repositorio": "...", "snapshot": { ... } }
```

O frontend usa esse snapshot em `concluir()`, na tela final e no
`WhatsAppService`. O objeto calculado no navegador nunca vira snapshot final.

### Veículo sem precificação

Categoria sem regra continua produzindo `statusPrecificacao: "UNAVAILABLE"` com
plano, mensalidade, participação e adesão em `null`. Uma solicitação que tente
enviar plano ou modalidade para essa categoria é rejeitada com `422`.

### Identidade do veículo

Hoje a validação é estrutural (tipo, código FIPE, valor, modelo, ano) para não
multiplicar chamadas à FIPE a cada envio. Os códigos `marcaCodigo`,
`modeloCodigo` e `anoCodigo` viajam no snapshot justamente para permitir uma
revalidação futura contra a API sem mudar o contrato.

## Rate limit

`src/lib/rate-limit` define o contrato `RateLimitProvider` com duas
implementações:

| Provider | Quando é usado | Distribuído |
| --- | --- | --- |
| `UpstashRateLimitProvider` | há `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` | **sim** |
| `MemoryRateLimitProvider` | nenhum dos dois | **não** |

Regras aplicadas por IP:

| Endpoint | Limite | Janela |
| --- | --- | --- |
| `POST /api/lead` | 8 | 10 min |
| `GET /api/placa` | 30 | 10 min |
| `GET /api/fipe/*` | 240 | 10 min |

**Aviso honesto:** em serverless o limitador em memória vale apenas para a
instância que atendeu a requisição — o limite efetivo é multiplicado pelo número
de instâncias ativas. O app diz isso no startup em produção em vez de fingir
cobertura global. Para um limite real, configure Upstash Redis ou Vercel KV
(mesma API REST).

Uma falha do limitador nunca derruba o endpoint: é registrada e a requisição
segue, para não bloquear clientes legítimos por indisponibilidade da infra.

## Consentimento

A captura do lead exige um checkbox **desmarcado por padrão**:

> Concordo com o uso dos meus dados para dar continuidade a este atendimento.

Sem ele o botão do WhatsApp não habilita, e o servidor recusa a solicitação com
`400`. O snapshot grava o momento do aceite em `consentimentoEm` e a versão do
texto aceito em `consentimentoVersao` (hoje `lead-contact-v1`), para que seja
possível saber no futuro qual texto cada cliente aceitou. Ao alterar o texto,
incremente `VERSAO_CONSENTIMENTO` em `src/lib/config.ts`.

`NEXT_PUBLIC_PRIVACY_POLICY_URL` adiciona o link para a Política de Privacidade
ao lado do texto. Sem a variável não há link — o código não inventa uma política.
