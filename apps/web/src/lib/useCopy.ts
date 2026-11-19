'use client';

import { useCallback, useEffect, useState } from 'react';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback abajo */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function useCopy(timeoutMs = 2000): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), timeoutMs);
    },
    [timeoutMs],
  );

  useEffect(() => () => setCopied(false), []);

  return [copied, copy];
}
