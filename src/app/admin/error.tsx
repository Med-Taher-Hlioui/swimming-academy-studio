"use client";
export default function AdminError({reset}:{reset:()=>void}) {
 return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Admin records could not be loaded</h1><p role="alert" className="my-4">Check your connection and retry. No successful save has been confirmed by this screen.</p><button className="button" onClick={reset}>Try again</button></main>;
}
