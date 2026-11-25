"use client";

import type { ChangeEvent, MouseEvent } from "react";

type DateFieldMode = "date" | "datetime" | "month";

type DateFieldProps = {
  mode: DateFieldMode;
  className?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  autoFocus?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function localInputToIso(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function DateField({
  mode,
  className,
  name,
  value,
  defaultValue,
  min,
  max,
  required,
  autoFocus,
  onChange,
}: DateFieldProps) {
  function openPicker(event: MouseEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (typeof input.showPicker !== "function") return;
    try {
      input.showPicker();
    } catch {
      // The calendar is already open, or this browser blocked a second call.
    }
  }

  return (
    <input
      autoFocus={autoFocus}
      className={`cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 ${className ?? ""}`}
      max={max}
      min={min}
      name={name}
      onChange={onChange}
      onClick={openPicker}
      required={required}
      step={mode === "datetime" ? 60 : undefined}
      type={mode === "datetime" ? "datetime-local" : mode}
      {...(value !== undefined ? { value } : { defaultValue })}
    />
  );
}
