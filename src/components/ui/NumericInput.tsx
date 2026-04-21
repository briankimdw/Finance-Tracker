"use client";

import { forwardRef, useCallback } from "react";

export type NumericInputSize = "default" | "hero";

export interface NumericInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Currency / unit prefix. Defaults to "$". Pass "" to hide. */
  prefix?: string;
  size?: NumericInputSize;
  autoFocus?: boolean;
  /** Optional id for the underlying input (for label `htmlFor`). */
  id?: string;
  /** Optional aria-label when there's no visible label. */
  ariaLabel?: string;
  /** Called on blur. */
  onBlur?: () => void;
  /** Disable the input. */
  disabled?: boolean;
  /** Mark as required for native form validation. */
  required?: boolean;
  /** Optional className appended to the wrapping element. */
  className?: string;
  /** Optional inputMode override. Default "decimal". */
  inputMode?: "decimal" | "numeric";
}

/**
 * Sanitize a raw input string so the value only ever contains digits and at
 * most one decimal point. Keeps mid-typing states like "0." or ".5" usable,
 * but strips leading zeros once a second real digit is typed (so "01" -> "1"
 * while "0" and "0.5" are preserved).
 */
function sanitize(raw: string): string {
  if (raw === "") return "";
  // Drop everything except digits and dots
  let out = "";
  let sawDot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch === "." && !sawDot) {
      out += ".";
      sawDot = true;
    }
  }
  // Strip leading zeros but keep "0", "0.", "0.x"
  if (out.length > 1 && out.startsWith("0") && out[1] !== ".") {
    // "01" -> "1", "007" -> "7"
    out = out.replace(/^0+/, "");
    if (out === "" || out.startsWith(".")) out = "0" + out;
  }
  return out;
}

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  {
    value,
    onChange,
    placeholder,
    prefix = "$",
    size = "default",
    autoFocus,
    id,
    ariaLabel,
    onBlur,
    disabled,
    required,
    className = "",
    inputMode = "decimal",
  },
  ref
) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = sanitize(e.target.value);
      if (cleaned !== value) onChange(cleaned);
    },
    [onChange, value]
  );

  if (size === "hero") {
    const isEmpty = value === "";
    return (
      <div className={`flex items-baseline justify-center gap-1 py-4 ${className}`}>
        {prefix && (
          <span
            aria-hidden
            className={`text-3xl font-light tabular-nums ${isEmpty ? "text-gray-300 dark:text-gray-600" : "text-gray-400 dark:text-gray-500"}`}
          >
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode={inputMode}
          pattern="[0-9]*\.?[0-9]*"
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          aria-label={ariaLabel ?? "Amount"}
          placeholder={placeholder ?? "0.00"}
          className="bg-transparent border-0 outline-none text-5xl font-semibold tabular-nums text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 text-center w-full max-w-[14ch] p-0 focus:ring-0"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    );
  }

  // default size: matches the existing input styling with a left prefix.
  return (
    <div className={`relative ${className}`}>
      {prefix && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500"
        >
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode={inputMode}
        pattern="[0-9]*\.?[0-9]*"
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        placeholder={placeholder ?? "0.00"}
        className={`w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg ${prefix ? "pl-6" : "pl-3"} pr-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 text-sm tabular-nums`}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
});

export default NumericInput;
