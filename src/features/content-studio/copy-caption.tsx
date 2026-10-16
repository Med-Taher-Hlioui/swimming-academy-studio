"use client";

import { useState } from "react";
import type { ContentCopy, ContentLanguage } from "./models";
import { captionText } from "./rules";

export function CopyCaption({ copy, language }: { copy: ContentCopy; language: ContentLanguage }) {
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState(false);
  async function copyText() {
    setStatus("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(captionText(copy));
      setStatus("Caption copied, including hook and call to action.");
      setFallback(false);
    } catch {
      setStatus("Clipboard access is unavailable. Select the text below and copy it manually.");
      setFallback(true);
    }
  }
  return <div>
    <button type="button" className="secondary-button" onClick={() => void copyText()}>Copy caption</button>
    <p role="status" className="mt-2 text-xs leading-5 text-slate-500">{status}</p>
    {fallback && <label className="field mt-2">Caption for manual copying
      <textarea readOnly rows={6} value={captionText(copy)} lang={language} dir={language === "aeb" ? "rtl" : "ltr"} onFocus={event => event.currentTarget.select()} />
    </label>}
  </div>;
}
