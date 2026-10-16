"use client";

import { Badge, Card, EmptyState } from "@/components/ui";
import { useContentStudio } from "./content-provider";
import { CopyCaption } from "./copy-caption";
import { languageLabels, objectiveLabels } from "./models";

export function GeneratedExamples() {
  const { generated, busy, saveExample, providerInfo } = useContentStudio();
  return <section aria-labelledby="examples-heading" className="mt-8">
    <h2 id="examples-heading" className="mb-4 text-xl font-semibold">2. Explore three angles</h2>
    {!generated ? <EmptyState title="Your next post starts with an idea" description={`Describe a fictional lesson or event above to generate three editable starting points with ${providerInfo.label}.`} /> : <>
      <p className="mb-4 text-xs text-slate-500">{generated.brief.platform} · {objectiveLabels[generated.brief.objective]} · {languageLabels[generated.brief.language]} · {providerInfo.label}</p>
      <div className="grid gap-4 xl:grid-cols-3">{generated.examples.map((copy, index) => <Card key={index}>
        <Badge>Example {index + 1}</Badge>
        <dl className="mt-5 space-y-4">
          <div><dt className="eyebrow">Hook</dt><dd className="mt-2 font-semibold" lang={generated.brief.language} dir={generated.brief.language === "aeb" ? "rtl" : "ltr"}>{copy.hook}</dd></div>
          <div><dt className="eyebrow">Caption</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600" lang={generated.brief.language} dir={generated.brief.language === "aeb" ? "rtl" : "ltr"}>{copy.caption}</dd></div>
          <div><dt className="eyebrow">Call to action</dt><dd className="mt-2 text-sm font-medium" lang={generated.brief.language} dir={generated.brief.language === "aeb" ? "rtl" : "ltr"}>{copy.cta}</dd></div>
        </dl>
        <div className="mt-6 space-y-3">
          <button type="button" className="button" disabled={busy || generated.saved.includes(index)} onClick={() => void saveExample(index)}>{generated.saved.includes(index) ? "Saved to drafts" : "Save as draft"}</button>
          <CopyCaption copy={copy} language={generated.brief.language} />
        </div>
      </Card>)}</div>
    </>}
  </section>;
}
