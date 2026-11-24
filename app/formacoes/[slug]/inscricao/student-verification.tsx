"use client";

import Image from "next/image";
import { useState } from "react";

export type VerifiedStudent = {
  token: string;
  student: { name: string; cardNumber: string };
};

export default function StudentVerification({ value, onChange }: {
  value: VerifiedStudent | null;
  onChange: (value: VerifiedStudent | null) => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verifyCard() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/students/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNumber }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Não foi possível validar o cartão CEU.",
        );
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("token" in result) ||
        typeof result.token !== "string" ||
        !("student" in result) ||
        typeof result.student !== "object" ||
        result.student === null ||
        !("name" in result.student) ||
        typeof result.student.name !== "string" ||
        !("cardNumber" in result.student) ||
        typeof result.student.cardNumber !== "string"
      ) {
        throw new Error("Resposta inválida da validação CEU.");
      }
      onChange({
        token: result.token,
        student: {
          name: result.student.name,
          cardNumber: result.student.cardNumber,
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível validar o cartão CEU.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group mt-6 rounded-2xl border border-[#e7e1df] bg-[#faf9f8] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-[#510f1d]">És estudante universitário?</span>
          <span className="mt-1 block text-sm leading-5 text-[#716a69]">
            Aproveita descontos exclusivos nos nossos produtos através da parceria com a CEU.
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-[#510f1d] transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-4 flex items-center gap-3 border-t border-[#e7e1df] pt-4">
        <Image alt="CEU" height={40} src="/logos/ceu.svg" width={103} />
        <span className="text-xs font-medium text-[#716a69]">Parceria CEU</span>
      </div>
      {value ? (
        <div className="mt-3 text-sm text-[#3e6b4e]">
          <p>Estudante CEU validado: {value.student.name}.</p>
          <p className="mt-1 text-xs">Cartão CEU: {value.student.cardNumber}</p>
          <p className="mt-1">O desconto será aplicado.</p>
          <button className="mt-2 text-[#510f1d] underline" onClick={() => onChange(null)} type="button">Remover desconto</button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Número do cartão CEU
            <input
              autoComplete="off"
              className="min-h-11 rounded-xl border border-[#d9d1cf] px-3"
              maxLength={128}
              onChange={(event) => setCardNumber(event.target.value)}
              value={cardNumber}
            />
          </label>
          <button
            className="rounded-full border border-[#510f1d] px-4 py-2 text-sm font-semibold text-[#510f1d] disabled:opacity-50"
            disabled={busy || !cardNumber.trim()}
            onClick={() => void verifyCard()}
            type="button"
          >
            {busy ? "A validar…" : "Validar cartão CEU"}
          </button>
          {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
        </div>
      )}
    </details>
  );
}
