import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude judgment wrapper.
 * Modelo default: claude-sonnet-4-6 (sweet spot custo x qualidade pra nuance de luxo).
 * Pra prod, override via env CLAUDE_MODEL.
 */

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");
  return new Anthropic({ apiKey });
}

// ============================================================
// TIPOS
// ============================================================

export type CreatorContextForJudgment = {
  handle: string;
  display_name: string | null;
  bio: string | null;
  follower_count: number | null;
  total_likes: number | null;
  verified: boolean;
  gmv_total_brl: number | null;
  orders_total: number | null;
  avg_ticket_brl: number | null;
  videos: Array<{
    caption: string | null;
    hashtags: string[];
    view_count: number | null;
    like_count: number | null;
    duration_seconds: number | null;
    posted_at: string | null;
    transcript: string | null;
    is_tiktok_shop: boolean;
    visual_analysis: {
      paleta?: string[];
      iluminacao?: string;
      cenario?: string;
      vibe?: string;
      luxo?: string[];
      anti_luxo?: string[];
      summary?: string;
      production_quality_score?: number;
    } | null;
  }>;
  exemplar_handles_sim: string[]; // exemplares "sim" do time L'Oréal pra calibração
};

export type LuxoFitScore = {
  luxo_fit_score: number;
  recommendation: "approve" | "monitor" | "borderline" | "reject";
  scores_by_criteria: {
    tom_de_voz: number;
    estetica_visual: number;
    vocabulario_de_beleza: number;
    qualidade_de_producao: number;
    compatibilidade_de_portfolio: number;
    consistencia_com_persona_marca: number;
  };
  justificativa_resumida: string;
  evidencias: string[];
  red_flags: string[];
  sugestao_acao: string;
};

export type JudgmentResult = {
  score: LuxoFitScore;
  raw_response: string;
  cost_usd: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
};

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildUserMessage(
  brandName: string,
  creator: CreatorContextForJudgment
): string {
  const profileSection = [
    `# Perfil da afiliada`,
    `Handle: @${creator.handle}`,
    `Nome: ${creator.display_name ?? "—"}`,
    `Bio: ${creator.bio ?? "—"}`,
    `Verificada: ${creator.verified ? "sim" : "não"}`,
    `Followers: ${creator.follower_count?.toLocaleString("pt-BR") ?? "—"}`,
    `Total likes: ${creator.total_likes?.toLocaleString("pt-BR") ?? "—"}`,
    ``,
    `# Performance TikTok Shop`,
    `GMV total: ${creator.gmv_total_brl ? `R$ ${creator.gmv_total_brl.toLocaleString("pt-BR")}` : "—"}`,
    `Pedidos: ${creator.orders_total ?? "—"}`,
    `Ticket médio: ${creator.avg_ticket_brl ? `R$ ${creator.avg_ticket_brl.toLocaleString("pt-BR")}` : "—"}`,
  ].join("\n");

  const videosSection = creator.videos
    .slice(0, 15)
    .map((v, i) => {
      const lines = [
        `## Vídeo ${i + 1}${v.is_tiktok_shop ? " [TikTok Shop]" : ""}`,
        `Postado em: ${v.posted_at?.slice(0, 10) ?? "—"}`,
        `Views: ${v.view_count?.toLocaleString("pt-BR") ?? "—"} · Likes: ${v.like_count?.toLocaleString("pt-BR") ?? "—"} · Duração: ${v.duration_seconds ?? "?"}s`,
      ];
      if (v.hashtags.length > 0) {
        lines.push(`Hashtags: ${v.hashtags.map((h) => `#${h}`).join(" ")}`);
      }
      if (v.caption) lines.push(`Caption: ${v.caption.slice(0, 400)}`);
      if (v.transcript)
        lines.push(`Transcript: ${v.transcript.slice(0, 1500)}`);
      if (v.visual_analysis) {
        const va = v.visual_analysis;
        const visualBits = [
          va.paleta?.length ? `paleta: ${va.paleta.join(", ")}` : null,
          va.iluminacao ? `iluminação: ${va.iluminacao}` : null,
          va.cenario ? `cenário: ${va.cenario}` : null,
          va.vibe ? `vibe: ${va.vibe}` : null,
          va.production_quality_score !== undefined
            ? `produção: ${va.production_quality_score}/100`
            : null,
          va.luxo?.length ? `sinais luxo: ${va.luxo.join(", ")}` : null,
          va.anti_luxo?.length
            ? `sinais anti-luxo: ${va.anti_luxo.join(", ")}`
            : null,
          va.summary ? `resumo visual: ${va.summary}` : null,
        ].filter(Boolean);
        if (visualBits.length > 0) {
          lines.push(`Análise visual (Gemini): ${visualBits.join(" · ")}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const exemplaresLine =
    creator.exemplar_handles_sim.length > 0
      ? [
          `**CALIBRAÇÃO — exemplares "sim" do time L'Oréal**: as seguintes afiliadas foram classificadas como "SIM" (encaixa em luxo) pelo curador humano: ${creator.exemplar_handles_sim.map((h) => `@${h}`).join(", ")}. Use esses perfis como ÂNCORA — se a afiliada que você está avaliando tem padrão estético/tom/portfólio comparável a um desses, deve receber score alto. **A régua é a deles, NÃO a teoria abstrata de luxo.** Não rejeite só porque o transcript fala "manchinha" ou "espinhazinha" — se o visual e o cenário batem, vale aprovar.`,
          ``,
        ]
      : [];

  return [
    `Avalie a afiliada abaixo contra a Brand Constitution de **${brandName}**.`,
    ``,
    ...exemplaresLine,
    `**Importante sobre o input**: você recebe (1) transcripts do que ela fala, (2) captions, (3) métricas de venda E (4) ANÁLISE VISUAL do Gemini quando disponível. **Priorize a análise visual** quando presente — o "luxo" se manifesta primeiro no visual, não no texto. Uma afiliada pode falar "manchinha" mas ter estética sofisticada — e isso é OK.`,
    ``,
    profileSection,
    ``,
    `# Vídeos`,
    videosSection || "(sem vídeos disponíveis)",
    ``,
    `Devolva sua análise usando a tool save_luxo_fit_score.`,
  ].join("\n");
}

// ============================================================
// JUDGMENT CALL
// ============================================================

const TOOL_DEFINITION: Anthropic.Tool = {
  name: "save_luxo_fit_score",
  description:
    "Registra o Luxo Fit Score completo da afiliada pra essa marca específica.",
  input_schema: {
    type: "object",
    properties: {
      luxo_fit_score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Score final 0-100 do match da afiliada com a marca.",
      },
      recommendation: {
        type: "string",
        enum: ["approve", "monitor", "borderline", "reject"],
        description:
          "approve (≥80), monitor (60-79), borderline (40-59), reject (<40). Red flag → reject automático.",
      },
      scores_by_criteria: {
        type: "object",
        properties: {
          tom_de_voz: { type: "integer", minimum: 0, maximum: 100 },
          estetica_visual: { type: "integer", minimum: 0, maximum: 100 },
          vocabulario_de_beleza: { type: "integer", minimum: 0, maximum: 100 },
          qualidade_de_producao: { type: "integer", minimum: 0, maximum: 100 },
          compatibilidade_de_portfolio: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          consistencia_com_persona_marca: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
        },
        required: [
          "tom_de_voz",
          "estetica_visual",
          "vocabulario_de_beleza",
          "qualidade_de_producao",
          "compatibilidade_de_portfolio",
          "consistencia_com_persona_marca",
        ],
      },
      justificativa_resumida: {
        type: "string",
        description:
          "2-3 frases claras pra gestora L'Oréal entender o porquê do score.",
      },
      evidencias: {
        type: "array",
        items: { type: "string" },
        description:
          "2-5 trechos curtos (transcript, caption, observação visual) que sustentam o score.",
      },
      red_flags: {
        type: "array",
        items: { type: "string" },
        description:
          "Sinalizadores absolutos detectados (preconceito, promessa médica, política, etc). Vazio se nenhum.",
      },
      sugestao_acao: {
        type: "string",
        description:
          "Ação concreta sugerida ao time L'Oréal em 1 frase (ex: 'Aprovar e priorizar pra próximas campanhas YSL').",
      },
    },
    required: [
      "luxo_fit_score",
      "recommendation",
      "scores_by_criteria",
      "justificativa_resumida",
      "evidencias",
      "red_flags",
      "sugestao_acao",
    ],
  },
};

/**
 * Pega o pricing por modelo (USD por milhão de tokens).
 * Atualizado em May/2026 — checar https://docs.claude.com/en/docs/about-claude/pricing
 */
function getPricing(model: string): { input: number; output: number } {
  if (model.startsWith("claude-opus-4")) return { input: 15, output: 75 };
  if (model.startsWith("claude-sonnet-4")) return { input: 3, output: 15 };
  if (model.startsWith("claude-haiku-4")) return { input: 0.8, output: 4 };
  return { input: 3, output: 15 }; // default Sonnet
}

export async function judgeCreatorForBrand(
  brandName: string,
  brandConstitution: string,
  creator: CreatorContextForJudgment,
  model: string = DEFAULT_MODEL
): Promise<JudgmentResult> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "save_luxo_fit_score" },
    system: brandConstitution,
    messages: [
      {
        role: "user",
        content: buildUserMessage(brandName, creator),
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude não retornou tool_use — resposta inválida");
  }

  const score = toolUse.input as unknown as LuxoFitScore;
  const pricing = getPricing(model);
  const cost =
    (response.usage.input_tokens * pricing.input) / 1_000_000 +
    (response.usage.output_tokens * pricing.output) / 1_000_000;

  return {
    score,
    raw_response: JSON.stringify(toolUse.input),
    cost_usd: cost,
    model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  };
}
