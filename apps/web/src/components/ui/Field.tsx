'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const FIELD_BASE =
  'w-full rounded-xl border border-white/10 bg-ink-900/80 px-4 text-mist-100 placeholder:text-mist-500 ' +
  'transition focus:border-marquee-400/70 focus:outline-none focus:ring-2 focus:ring-marquee-400/25 ' +
  'disabled:opacity-50';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel, id, className = '', ...props },
  ref,
) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={fieldId}
        className={
          hideLabel ? 'sr-only' : 'block text-xs font-medium uppercase tracking-wider text-mist-400'
        }
      >
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`${FIELD_BASE} h-12 ${error ? 'border-rose-500/60' : ''} ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-mist-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className = '', ...props },
  ref,
) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_BASE} resize-none py-3 ${className}`}
        {...props}
      />
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-mist-500">{hint}</p> : null}
    </div>
  );
});
