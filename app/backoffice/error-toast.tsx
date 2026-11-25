"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ErrorToastContextValue = {
  showError: (message: string) => void;
};

const ErrorToastContext = createContext<ErrorToastContextValue | null>(null);

export function ErrorToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const showError = useCallback((next: string) => {
    clearTimer();
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(""), 8000);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <ErrorToastContext.Provider value={{ showError }}>
      {children}
      {message ? (
        <div className="fixed inset-x-4 top-4 z-[200] mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 shadow-lg" role="alert">
          <p className="flex-1">{message}</p>
          <button
            aria-label="Fechar aviso"
            className="text-base leading-none text-red-800"
            onClick={() => {
              clearTimer();
              setMessage("");
            }}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}
    </ErrorToastContext.Provider>
  );
}

export function useErrorToast() {
  const context = useContext(ErrorToastContext);
  if (!context) {
    throw new Error("O aviso de erro só pode ser usado dentro do backoffice.");
  }
  return context.showError;
}
