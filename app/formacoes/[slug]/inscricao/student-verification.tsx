"use client";

import { useState } from "react";

export type VerifiedStudent = {
  token: string;
  student: { name: string; email: string; phone: string };
};

export default function StudentVerification({ value, onChange }: {
  value: VerifiedStudent | null;
  onChange: (value: VerifiedStudent | null) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(path: string, payload: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "Não foi possível verificar os dados.");
    }
    return result;
  }

  async function requestCode() {
    setBusy(true);
    setError("");
    try {
      const result = await send("/api/students/verification", { identifier });
      if (typeof result !== "object" || result === null || !("id" in result) || typeof result.id !== "string") throw new Error("Resposta inválida.");
      setId(result.id);
      setCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível pedir o código.");
    } finally { setBusy(false); }
  }

  async function confirmCode() {
    setBusy(true);
    setError("");
    try {
      const result = await send("/api/students/verification/confirm", { id, code });
      if (typeof result !== "object" || result === null || !("token" in result) || typeof result.token !== "string" ||
          !("student" in result) || typeof result.student !== "object" || result.student === null ||
          !("name" in result.student) || typeof result.student.name !== "string" ||
          !("email" in result.student) || typeof result.student.email !== "string" ||
          !("phone" in result.student) || typeof result.student.phone !== "string") throw new Error("Resposta inválida.");
      onChange({ token: result.token, student: { name: result.student.name, email: result.student.email, phone: result.student.phone } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível confirmar o código.");
    } finally { setBusy(false); }
  }

  return (
    <details className="mt-6 rounded-2xl border border-[#e7e1df] bg-[#faf9f8] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#510f1d]">Sou aluno de uma instituição parceira</summary>
      {value ? (
        <div className="mt-3 text-sm text-[#3e6b4e]">
          <p>Aluno verificado: {value.student.name}. O desconto será aplicado.</p>
          <button className="mt-2 text-[#510f1d] underline" onClick={() => { onChange(null); setId(""); }} type="button">Remover desconto</button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Email ou telefone do aluno
            <input autoComplete="off" className="min-h-11 rounded-xl border border-[#d9d1cf] px-3" maxLength={254} onChange={(e) => { setIdentifier(e.target.value); setId(""); }} value={identifier} />
          </label>
          <button className="rounded-full border border-[#510f1d] px-4 py-2 text-sm font-semibold text-[#510f1d] disabled:opacity-50" disabled={busy || !identifier.trim()} onClick={() => void requestCode()} type="button">
            {busy ? "Aguarde…" : id ? "Pedir novo código" : "Enviar código por email"}
          </button>
          {id ? (
            <>
              <p className="text-xs leading-5 text-[#716a69]">Se os dados corresponderem a um aluno, receberá um código no email registado. Verifique também o spam.</p>
              <label className="grid gap-1 text-sm font-medium">
                Código de seis dígitos
                <input autoComplete="one-time-code" className="min-h-11 rounded-xl border border-[#d9d1cf] px-3" inputMode="numeric" maxLength={6} onChange={(e) => setCode(e.target.value)} value={code} />
              </label>
              <button className="rounded-full bg-[#510f1d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => void confirmCode()} type="button">Confirmar código</button>
            </>
          ) : null}
          {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
        </div>
      )}
    </details>
  );
}
