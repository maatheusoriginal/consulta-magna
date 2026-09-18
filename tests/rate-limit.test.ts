import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AVISO_RATE_LIMIT_NAO_DISTRIBUIDO,
  MemoryRateLimitProvider,
  REGRAS,
  UpstashRateLimitProvider,
  aplicarRateLimit,
  criarRateLimitProvider,
  identificarCliente,
} from "@/lib/rate-limit";

const REGRA = { nome: "teste", limite: 3, janelaMs: 60_000 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MemoryRateLimitProvider", () => {
  it("permite até o limite e bloqueia depois", async () => {
    const provider = new MemoryRateLimitProvider();

    for (let i = 0; i < REGRA.limite; i += 1) {
      const r = await provider.consumir("ip-1", REGRA);
      expect(r.permitido).toBe(true);
    }

    const excedente = await provider.consumir("ip-1", REGRA);
    expect(excedente.permitido).toBe(false);
    expect(excedente.restante).toBe(0);
    expect(excedente.retryApos).toBeGreaterThan(0);
  });

  it("conta por chave, sem afetar outros clientes", async () => {
    const provider = new MemoryRateLimitProvider();

    for (let i = 0; i < REGRA.limite + 2; i += 1) await provider.consumir("ip-1", REGRA);
    expect((await provider.consumir("ip-2", REGRA)).permitido).toBe(true);
  });

  it("libera novamente quando a janela expira", async () => {
    vi.useFakeTimers();
    const provider = new MemoryRateLimitProvider();

    for (let i = 0; i < REGRA.limite; i += 1) await provider.consumir("ip-1", REGRA);
    expect((await provider.consumir("ip-1", REGRA)).permitido).toBe(false);

    vi.advanceTimersByTime(REGRA.janelaMs + 1);
    expect((await provider.consumir("ip-1", REGRA)).permitido).toBe(true);

    vi.useRealTimers();
  });

  it("declara que NÃO é distribuído", () => {
    expect(new MemoryRateLimitProvider().distribuido).toBe(false);
  });
});

describe("escolha do provider", () => {
  it("usa o Upstash quando as credenciais existem", () => {
    const aviso = vi.fn();
    const provider = criarRateLimitProvider(
      {
        NODE_ENV: "production",
        UPSTASH_REDIS_REST_URL: "https://exemplo.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token",
      } as NodeJS.ProcessEnv,
      aviso,
    );

    expect(provider).toBeInstanceOf(UpstashRateLimitProvider);
    expect(provider.distribuido).toBe(true);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("em produção sem provider distribuído, avisa em vez de fingir cobertura global", () => {
    const aviso = vi.fn();
    const provider = criarRateLimitProvider({ NODE_ENV: "production" } as NodeJS.ProcessEnv, aviso);

    expect(provider).toBeInstanceOf(MemoryRateLimitProvider);
    expect(provider.distribuido).toBe(false);
    expect(aviso).toHaveBeenCalledWith(AVISO_RATE_LIMIT_NAO_DISTRIBUIDO);
    expect(AVISO_RATE_LIMIT_NAO_DISTRIBUIDO).toMatch(/NÃO é um limite global/);
  });

  it("fora de produção não avisa", () => {
    const aviso = vi.fn();
    criarRateLimitProvider({ NODE_ENV: "development" } as NodeJS.ProcessEnv, aviso);
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe("UpstashRateLimitProvider", () => {
  it("conta no Redis e respeita o limite", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify([{ result: 9 }, { result: 1 }, { result: 120 }]), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new UpstashRateLimitProvider("https://exemplo.upstash.io", "token");
    const resultado = await provider.consumir("ip-1", { ...REGRA, limite: 8 });

    expect(resultado.permitido).toBe(false);
    expect(resultado.retryApos).toBe(120);

    const corpo = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as string[][];
    expect(corpo[0][0]).toBe("INCR");
    // O TTL só é definido na primeira requisição da janela.
    expect(corpo[1]).toEqual(["EXPIRE", corpo[0][1], "60", "NX"]);
  });
});

describe("identificação do cliente", () => {
  it("usa o primeiro IP de x-forwarded-for", () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "203.0.113.10, 70.41.3.18" },
    });
    expect(identificarCliente(req)).toBe("203.0.113.10");
  });

  it("cai para x-real-ip e depois para um valor neutro", () => {
    expect(
      identificarCliente(new Request("http://localhost/x", { headers: { "x-real-ip": "198.51.100.7" } })),
    ).toBe("198.51.100.7");
    expect(identificarCliente(new Request("http://localhost/x"))).toBe("desconhecido");
  });
});

describe("aplicarRateLimit", () => {
  const req = () =>
    new Request("http://localhost/api/lead", { headers: { "x-forwarded-for": "203.0.113.10" } });

  it("deixa passar dentro do limite e responde 429 fora dele", async () => {
    const provider = new MemoryRateLimitProvider();

    for (let i = 0; i < REGRA.limite; i += 1) {
      expect(await aplicarRateLimit(req(), REGRA, provider)).toBeNull();
    }

    const bloqueio = await aplicarRateLimit(req(), REGRA, provider);
    expect(bloqueio?.status).toBe(429);
    expect(bloqueio?.headers.get("Retry-After")).toBeTruthy();
    expect(await bloqueio?.json()).toEqual({
      erro: "Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.",
    });
  });

  it("falha do limitador não derruba o endpoint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const quebrado = {
      nome: "Quebrado",
      distribuido: true,
      consumir: async () => {
        throw new Error("redis fora do ar");
      },
    };

    expect(await aplicarRateLimit(req(), REGRA, quebrado)).toBeNull();
  });
});

describe("regras dos endpoints públicos", () => {
  it("cobrem lead, placa e FIPE", () => {
    expect(Object.keys(REGRAS).sort()).toEqual(["fipe", "lead", "placa"]);
  });

  it("não atrapalham o uso normal", () => {
    // Uma cotação completa faz poucas chamadas de cada tipo.
    expect(REGRAS.lead.limite).toBeGreaterThanOrEqual(5);
    expect(REGRAS.placa.limite).toBeGreaterThanOrEqual(20);
    expect(REGRAS.fipe.limite).toBeGreaterThanOrEqual(100);
    for (const regra of Object.values(REGRAS)) {
      expect(regra.janelaMs).toBeGreaterThanOrEqual(60_000);
    }
  });
});
