/**
 * TikWM — serviço público de download TikTok sem marca d'água.
 * https://www.tikwm.com/api
 *
 * Uso: passa URL do TikTok, retorna URL do MP4 limpo.
 * Free, sem autenticação, mas tem rate limit (~1 req/s).
 */

const BASE_URL = "https://www.tikwm.com/api/";

export type TikWMResponse = {
  code: number;
  msg: string;
  data?: {
    id: string;
    title: string;
    play: string; // MP4 URL sem watermark
    wmplay?: string; // MP4 URL com watermark
    duration: number;
    cover?: string;
    size: number; // bytes
  };
};

/**
 * Pega URL do MP4 sem watermark de um vídeo TikTok.
 */
export async function getTikTokDownloadUrl(
  tiktokUrl: string
): Promise<{ mp4Url: string; durationSec: number; sizeBytes: number }> {
  const url = `${BASE_URL}?url=${encodeURIComponent(tiktokUrl)}&hd=0`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`TikWM HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as TikWMResponse;
  if (json.code !== 0 || !json.data?.play) {
    throw new Error(`TikWM error: ${json.msg || "sem dados"}`);
  }

  return {
    mp4Url: json.data.play,
    durationSec: json.data.duration ?? 0,
    sizeBytes: json.data.size ?? 0,
  };
}

/**
 * Baixa o MP4 pra Buffer (pra mandar inline ao Gemini).
 * MAX 20MB pra inline data — corta cedo se vídeo for muito grande.
 */
const MAX_BYTES = 18 * 1024 * 1024; // 18MB de safety

export async function downloadVideoBytes(mp4Url: string): Promise<Buffer> {
  const res = await fetch(mp4Url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Download MP4 HTTP ${res.status}: ${res.statusText}`);
  }

  const contentLength = parseInt(res.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BYTES) {
    throw new Error(
      `Vídeo muito grande (${(contentLength / 1024 / 1024).toFixed(1)}MB > ${MAX_BYTES / 1024 / 1024}MB)`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Vídeo muito grande (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB > ${MAX_BYTES / 1024 / 1024}MB)`
    );
  }

  return Buffer.from(arrayBuffer);
}
