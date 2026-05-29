"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function normalizeBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10) return `55${digits.replace(/^0/, "")}`;
  return digits;
}

function whatsAppLink(
  phone: string,
  handle: string,
  displayName: string | null
): string {
  const text = encodeURIComponent(
    `Hi ${displayName ?? handle}! This is SHOPFLOW reaching out. We'd love to chat about a campaign partnership with L'Oréal Luxe — would you be interested?`
  );
  return `https://wa.me/${normalizeBR(phone)}?text=${text}`;
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

  function handleWhatsAppNoPhone() {
    const input = window.prompt(
      `No WhatsApp number found in @${handle}'s bio.\n\nEnter the phone number manually (with area code, e.g. 11987654321):`,
      ""
    );
    if (!input) return;
    const clean = normalizeBR(input);
    if (clean.length < 12) {
      alert("Invalid phone number. Please enter at least DDD + number.");
      return;
    }
    window.open(whatsAppLink(clean, handle, displayName), "_blank");
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

      {phone ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-gold/40 text-gold hover:bg-gold/10"
          asChild
        >
          <a
            href={whatsAppLink(phone, handle, displayName)}
            target="_blank"
            rel="noreferrer"
            title={`WhatsApp ${phone}`}
          >
            WhatsApp
          </a>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full border-gold/40 text-gold hover:bg-gold/10"
          onClick={handleWhatsAppNoPhone}
          title="No number in bio — enter manually"
        >
          WhatsApp +
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
