"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function buildWhatsAppLink(phone: string, handle: string, displayName: string | null): string {
  // Limpa pra formato wa.me (só dígitos)
  const digits = phone.replace(/\D/g, "");
  // Se começar com 0 ou não tiver 55, adiciona
  const normalized = digits.startsWith("55")
    ? digits
    : digits.length >= 10
      ? `55${digits.replace(/^0/, "")}`
      : digits;
  const text = encodeURIComponent(
    `Hi ${displayName ?? handle}! This is SHOPFLOW reaching out. We'd love to chat about a campaign partnership with L'Oréal Luxe — would you be interested?`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

export function ContactActions({
  handle,
  displayName,
  phone,
  email,
}: {
  handle: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copyHandle() {
    navigator.clipboard.writeText(`@${handle}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="default"
        className="rounded-full"
        asChild
      >
        <a
          href={`https://www.tiktok.com/@${handle}`}
          target="_blank"
          rel="noreferrer"
        >
          Message on TikTok
        </a>
      </Button>

      {phone && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-gold/40 text-gold hover:bg-gold/10"
          asChild
        >
          <a
            href={buildWhatsAppLink(phone, handle, displayName)}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </Button>
      )}

      {email && (
        <Button size="sm" variant="outline" className="rounded-full" asChild>
          <a href={`mailto:${email}?subject=L'Oréal Luxe partnership`}>
            Email
          </a>
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="rounded-full"
        onClick={copyHandle}
      >
        {copied ? "Copied ✓" : `Copy @${handle}`}
      </Button>
    </div>
  );
}
