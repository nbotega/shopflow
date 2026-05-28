import { GoogleGenAI, Type } from "@google/genai";

/**
 * Gemini multimodal wrapper.
 * Analisa estética de vídeo TikTok pra alimentar o judgment do Claude.
 *
 * Modelo default: gemini-2.5-flash (sweet spot custo x qualidade visual).
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_KEY não configurada");
  return new GoogleGenAI({ apiKey });
}

// ============================================================
// TIPOS
// ============================================================

export type VideoAestheticAnalysis = {
  paleta_dominante: string[];
  iluminacao: string;
  cenario: string;
  producao_quality_score: number;
  vibe: string;
  elementos_luxo_detectados: string[];
  elementos_anti_luxo_detectados: string[];
  brand_aesthetic_match: {
    ysl_score: number;
    lancome_score: number;
    justificativa_curta: string;
  };
  summary: string;
};

export type GeminiAnalysisResult = {
  analysis: VideoAestheticAnalysis;
  model: string;
  raw_response: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
};

// ============================================================
// PROMPT + SCHEMA
// ============================================================

const SYSTEM_INSTRUCTION = `Você é um analista visual especializado em luxo cosmético, contratado pela L'Oréal Luxe pra avaliar a estética de afiliadas TikTok contra duas marcas: YSL Beauté (elegância rebelde, dramática, noturna, preto/dourado, urbana) e Lancôme (otimismo francês, luz natural, rosa/quentes, sofisticada acolhedora).

Analise o vídeo focando ESTRITAMENTE em:
- Paleta de cor dominante (3-5 cores)
- Iluminação (natural/dramática/clínica/dura/suave/etc)
- Cenário (descrição breve, 1 frase)
- Qualidade de produção (0-100): amador ≤40, médio 40-70, profissional ≥70
- Vibe geral (1-3 palavras)
- Sinais POSITIVOS de luxo (composição cuidada, paleta sofisticada, estética assinada, ritual visual)
- Sinais NEGATIVOS de luxo (Comic Sans, brilho excessivo, vibe "Mercado Livre", iluminação dura clínica, cenário desorganizado, transições agressivas)
- Score 0-100 de match estético com YSL e com Lancôme separadamente

Ignore o áudio/fala — foco TOTAL em visual.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    paleta_dominante: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 cores dominantes (português)",
    },
    iluminacao: { type: Type.STRING },
    cenario: { type: Type.STRING },
    producao_quality_score: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    vibe: { type: Type.STRING },
    elementos_luxo_detectados: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    elementos_anti_luxo_detectados: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    brand_aesthetic_match: {
      type: Type.OBJECT,
      properties: {
        ysl_score: { type: Type.INTEGER, minimum: 0, maximum: 100 },
        lancome_score: { type: Type.INTEGER, minimum: 0, maximum: 100 },
        justificativa_curta: { type: Type.STRING },
      },
      required: ["ysl_score", "lancome_score", "justificativa_curta"],
    },
    summary: { type: Type.STRING, description: "2-3 frases sintetizando" },
  },
  required: [
    "paleta_dominante",
    "iluminacao",
    "cenario",
    "producao_quality_score",
    "vibe",
    "elementos_luxo_detectados",
    "elementos_anti_luxo_detectados",
    "brand_aesthetic_match",
    "summary",
  ],
};

// ============================================================
// PRICING (Gemini 2.5 Flash, May/2026)
// $0.10/$0.40 por M tokens (input/output) — text/image/video
// ============================================================

function getPricing(model: string): { input: number; output: number } {
  if (model.includes("3-flash") || model.includes("3-pro")) {
    return { input: 0.3, output: 2.5 };
  }
  if (model.includes("2.5-flash-lite")) {
    return { input: 0.1, output: 0.4 };
  }
  if (model.includes("2.5-flash")) {
    return { input: 0.3, output: 2.5 };
  }
  if (model.includes("2.5-pro")) {
    return { input: 1.25, output: 10 };
  }
  return { input: 0.3, output: 2.5 };
}

// ============================================================
// API CALL
// ============================================================

// Cadeia: principal → lite (mais resiliente) → 3-flash-preview (mais novo, menos congestionado)
const MODEL_FALLBACK_CHAIN = [
  DEFAULT_MODEL,
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
];

const RETRY_DELAYS_MS = [1500]; // 1 retry rápido por modelo só

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  // 503 overloaded, 429 rate limit, 500 internal, network errors
  return /\b(503|429|500|502|504|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|fetch failed|network|timeout)\b/i.test(
    msg
  );
}

type MediaPart = { bytes: Buffer; mimeType: string };

async function callGeminiOnce(
  ai: ReturnType<typeof getClient>,
  model: string,
  media: MediaPart[]
): Promise<{
  rawText: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const parts = [
    ...media.map((m) => ({
      inlineData: {
        mimeType: m.mimeType,
        data: m.bytes.toString("base64"),
      },
    })),
    {
      text:
        media.length > 1
          ? `Analise a estética visual conjunta destas ${media.length} imagens (capas de vídeos TikTok da mesma afiliada) seguindo o schema. Foco apenas no visual (paleta, iluminação, cenário, produção, vibe). Identifique padrão CONSISTENTE entre os frames.`
          : "Analise a estética visual desta imagem (capa de vídeo TikTok) seguindo o schema. Foco apenas no visual (paleta, iluminação, cenário, produção, vibe).",
    },
  ];

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 1024,
    },
  });

  const rawText = response.text;
  if (!rawText) throw new Error("Gemini retornou resposta vazia");

  const usage = response.usageMetadata;
  return {
    rawText,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

/**
 * Analisa estética a partir de 1+ imagens (capas/frames).
 * Muito mais leve que vídeo — usa cover images do TikTok em vez de MP4.
 */
export async function analyzeImagesAesthetics(
  images: MediaPart[],
  preferredModel: string = DEFAULT_MODEL
): Promise<GeminiAnalysisResult> {
  const ai = getClient();

  const chain = [
    preferredModel,
    ...MODEL_FALLBACK_CHAIN.filter((m) => m !== preferredModel),
  ];

  let lastError: unknown = null;

  for (const model of chain) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const { rawText, inputTokens, outputTokens } = await callGeminiOnce(
          ai,
          model,
          images
        );

        let analysis: VideoAestheticAnalysis;
        try {
          analysis = JSON.parse(rawText);
        } catch (err) {
          throw new Error(
            `JSON parse: ${err instanceof Error ? err.message : err}. Raw: ${rawText.slice(0, 150)}`
          );
        }

        const pricing = getPricing(model);
        const cost =
          (inputTokens * pricing.input) / 1_000_000 +
          (outputTokens * pricing.output) / 1_000_000;

        return {
          analysis,
          model,
          raw_response: rawText,
          cost_usd: cost,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        };
      } catch (err) {
        lastError = err;
        if (!isRetryableError(err)) {
          // Erro não-retryable: pula direto pro próximo modelo
          break;
        }
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  // Sem slice — quero ver erro completo no debug
  throw new Error(
    `Gemini falhou após tentar [${chain.join(", ")}]: ${msg}`
  );
}
