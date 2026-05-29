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
    `# Affiliate profile`,
    `Handle: @${creator.handle}`,
    `Name: ${creator.display_name ?? "—"}`,
    `Bio: ${creator.bio ?? "—"}`,
    `Verified: ${creator.verified ? "yes" : "no"}`,
    `Followers: ${creator.follower_count?.toLocaleString("en-US") ?? "—"}`,
    `Total likes: ${creator.total_likes?.toLocaleString("en-US") ?? "—"}`,
    ``,
    `# TikTok Shop performance`,
    `Total GMV: ${creator.gmv_total_brl ? `R$ ${creator.gmv_total_brl.toLocaleString("pt-BR")}` : "—"}`,
    `Orders: ${creator.orders_total ?? "—"}`,
    `Avg. ticket: ${creator.avg_ticket_brl ? `R$ ${creator.avg_ticket_brl.toLocaleString("pt-BR")}` : "—"}`,
  ].join("\n");

  const videosSection = creator.videos
    .slice(0, 15)
    .map((v, i) => {
      const lines = [
        `## Video ${i + 1}${v.is_tiktok_shop ? " [TikTok Shop]" : ""}`,
        `Posted: ${v.posted_at?.slice(0, 10) ?? "—"}`,
        `Views: ${v.view_count?.toLocaleString("en-US") ?? "—"} · Likes: ${v.like_count?.toLocaleString("en-US") ?? "—"} · Duration: ${v.duration_seconds ?? "?"}s`,
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
          va.paleta?.length ? `palette: ${va.paleta.join(", ")}` : null,
          va.iluminacao ? `lighting: ${va.iluminacao}` : null,
          va.cenario ? `setting: ${va.cenario}` : null,
          va.vibe ? `vibe: ${va.vibe}` : null,
          va.production_quality_score !== undefined
            ? `production: ${va.production_quality_score}/100`
            : null,
          va.luxo?.length ? `luxury signals: ${va.luxo.join(", ")}` : null,
          va.anti_luxo?.length
            ? `anti-luxury signals: ${va.anti_luxo.join(", ")}`
            : null,
          va.summary ? `visual summary: ${va.summary}` : null,
        ].filter(Boolean);
        if (visualBits.length > 0) {
          lines.push(`Visual analysis (Gemini): ${visualBits.join(" · ")}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const exemplaresLine =
    creator.exemplar_handles_sim.length > 0
      ? [
          `**CALIBRATION — "approved" exemplars by L'Oréal team**: the following affiliates were classified as "ON BRAND" (luxury fit) by the human curator: ${creator.exemplar_handles_sim.map((h) => `@${h}`).join(", ")}. Use these profiles as ANCHORS — if the affiliate you're evaluating has an aesthetic/tone/portfolio comparable to any of them, give a high score. **The ruler is theirs, NOT abstract luxury theory.** Don't reject just because the transcript uses casual diminutives — if the visual and setting match, it's a yes.`,
          ``,
        ]
      : [];

  return [
    `Evaluate the affiliate below against the Brand Constitution of **${brandName}**.`,
    ``,
    `**RESPOND IN ENGLISH.** Even though the Brand Constitution is written in Portuguese and the field names of the JSON output are in Portuguese (justificativa_resumida, evidencias, sugestao_acao, red_flags), the VALUES you write in those fields must be in fluent professional ENGLISH. This output goes to L'Oréal's global marketing team.`,
    ``,
    ...exemplaresLine,
    `**About the input**: you receive (1) transcripts of what she says, (2) captions, (3) sales metrics, AND (4) VISUAL ANALYSIS from Gemini when available. **Prioritize the visual analysis** when present — "luxury" manifests first in the visual, not in the text. An affiliate may speak casually ("manchinha", "espinhazinha") but have sophisticated aesthetics — and that's OK.`,
    ``,
    profileSection,
    ``,
    `# Videos`,
    videosSection || "(no videos available)",
    ``,
    `Return your analysis using the save_luxo_fit_score tool. Write all text values in English.`,
  ].join("\n");
}

// ============================================================
// JUDGMENT CALL
// ============================================================

const TOOL_DEFINITION: Anthropic.Tool = {
  name: "save_luxo_fit_score",
  description:
    "Save the full Match Score for this affiliate against this specific brand. All text values must be in English.",
  input_schema: {
    type: "object",
    properties: {
      luxo_fit_score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Final 0-100 score of affiliate fit against the brand.",
      },
      recommendation: {
        type: "string",
        enum: ["approve", "monitor", "borderline", "reject"],
        description:
          "approve (≥80), monitor (60-79), borderline (40-59), reject (<40). Red flag → automatic reject.",
      },
      scores_by_criteria: {
        type: "object",
        properties: {
          tom_de_voz: { type: "integer", minimum: 0, maximum: 100, description: "Tone of voice (0-100)" },
          estetica_visual: { type: "integer", minimum: 0, maximum: 100, description: "Visual aesthetics (0-100)" },
          vocabulario_de_beleza: { type: "integer", minimum: 0, maximum: 100, description: "Beauty vocabulary (0-100)" },
          qualidade_de_producao: { type: "integer", minimum: 0, maximum: 100, description: "Production quality (0-100)" },
          compatibilidade_de_portfolio: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Portfolio compatibility (0-100)",
          },
          consistencia_com_persona_marca: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Brand persona consistency (0-100)",
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
          "IN ENGLISH. 2-3 clear sentences for the L'Oréal manager to understand the reasoning.",
      },
      evidencias: {
        type: "array",
        items: { type: "string" },
        description:
          "IN ENGLISH. 2-5 short excerpts (transcript, caption, visual observation) supporting the score. Quote original Portuguese phrases when relevant but explain in English.",
      },
      red_flags: {
        type: "array",
        items: { type: "string" },
        description:
          "IN ENGLISH. Absolute flags detected (bias, medical claims, politics, etc). Empty if none.",
      },
      sugestao_acao: {
        type: "string",
        description:
          "IN ENGLISH. Concrete action recommended to the L'Oréal team in 1 sentence (e.g. 'Approve and prioritize for upcoming YSL campaigns').",
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
    system: [
      {
        type: "text",
        text: "You are a luxury-beauty editorial curator working for L'Oréal Luxe. **All your written output (justificativa_resumida, evidencias, red_flags, sugestao_acao) MUST be in fluent professional ENGLISH.** The Brand Constitution below is in Portuguese for internal calibration, but your output is consumed by L'Oréal's global team in English.",
      },
      { type: "text", text: brandConstitution },
    ],
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
