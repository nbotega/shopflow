"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";

type ImportResult = {
  success: boolean;
  csv_total_rows?: number;
  csv_skipped?: number;
  creators_imported?: number;
  brands_assigned?: number;
  total_assignments?: number;
  label_distribution?: {
    sim: number;
    nao: number;
    maybe: number;
    sem_label: number;
  };
  error?: string;
};

export function CSVUpload() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);
    setFilename(file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import-csv", {
        method: "POST",
        body: formData,
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.success) router.refresh();
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Importar lista de afiliadas (CSV)</h3>
        <p className="text-xs text-muted-foreground mt-1">
          CSV no formato do time L&apos;Oréal (Creator name, TikTok URL, GMV
          Total, Pedidos, Ticket Médio, luxo?). Só importa afiliadas com GMV
          &gt; 0.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando {filename}...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Selecionar CSV
          </>
        )}
      </Button>

      {result && (
        <div className="text-sm border-t pt-4 space-y-2">
          {result.success ? (
            <>
              <p className="font-medium">
                {result.creators_imported} afiliadas importadas (de{" "}
                {result.csv_total_rows} linhas — {result.csv_skipped} pulada
                {result.csv_skipped === 1 ? "" : "s"} por GMV=0 ou sem handle)
              </p>
              <p className="text-muted-foreground text-xs">
                {result.total_assignments} análises criadas (
                {result.creators_imported} afiliadas ×{" "}
                {result.brands_assigned} marcas)
              </p>
              {result.label_distribution && (
                <div className="text-xs flex gap-4 pt-2">
                  <span>
                    <span className="font-medium text-foreground">
                      {result.label_distribution.sim}
                    </span>{" "}
                    sim
                  </span>
                  <span>
                    <span className="font-medium text-foreground">
                      {result.label_distribution.nao}
                    </span>{" "}
                    não
                  </span>
                  <span>
                    <span className="font-medium text-foreground">
                      {result.label_distribution.maybe}
                    </span>{" "}
                    maybe
                  </span>
                  <span className="text-muted-foreground">
                    {result.label_distribution.sem_label} sem label
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-destructive">
              {result.error ?? "Falha no import"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
