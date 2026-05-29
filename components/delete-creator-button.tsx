"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";

export function DeleteCreatorButton({
  creatorId,
  handle,
  variant = "icon",
}: {
  creatorId: string;
  handle: string;
  variant?: "icon" | "text";
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remover @${handle} do pool?\n\nIsso apaga todos os dados dela (vídeos, transcrições, scores, avaliações).`))
      return;

    setLoading(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Erro: ${data.error ?? "desconhecido"}`);
      } else {
        // Se estava na página de detalhe, vai pra lista
        if (window.location.pathname.includes(`/creators/${creatorId}`)) {
          router.push("/dashboard/creators");
        } else {
          router.refresh();
        }
      }
    } catch (err) {
      alert(`Falha: ${err instanceof Error ? err.message : "rede"}`);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "text") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs uppercase tracking-wider text-destructive/70 hover:text-destructive transition-colors disabled:opacity-50"
      >
        {loading ? "Removendo..." : "Remover do pool"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={`Remover @${handle} do pool`}
      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 disabled:opacity-100"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
