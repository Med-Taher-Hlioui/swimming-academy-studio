"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AcademyService, Dashboard } from "./models";
import { createDemoSnapshot, createMemoryAcademyRepository } from "./mock-repository";
import { createAcademyService, deriveDashboard } from "./service";
import { usePathname } from "next/navigation";

interface DemoContextValue {
  data: Dashboard;
  busy: boolean;
  error: string;
  message: string;
  feedbackPath: string;
  run: (operation: (service: AcademyService) => Promise<Dashboard>, success: string) => Promise<boolean>;
  reset: () => void;
}
const DemoContext = createContext<DemoContextValue | null>(null);

function createDemo() {
  return {
    service: createAcademyService(createMemoryAcademyRepository()),
    data: deriveDashboard(createDemoSnapshot()),
  };
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [demo, setDemo] = useState(createDemo);
  const [data, setData] = useState(demo.data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [feedbackPath, setFeedbackPath] = useState(pathname);
  const running = useRef(false);
  const [generation, setGeneration] = useState(0);

  async function run(operation: (service: AcademyService) => Promise<Dashboard>, success: string) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setFeedbackPath(pathname);
    setError("");
    setMessage("");
    try {
      setData(await operation(demo.service));
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The demo change could not be saved.");
      return false;
    } finally { running.current = false; setBusy(false); }
  }
  function reset() {
    if (running.current) return;
    const next = createDemo();
    setDemo(next);
    setData(next.data);
    setError("");
    setMessage("Fictional demo data restored.");
    setFeedbackPath(pathname);
    setGeneration(value => value + 1);
  }
  return <DemoContext.Provider value={{ data, busy, error, message, feedbackPath, run, reset }}>
    <div key={generation}>{children}</div>
  </DemoContext.Provider>;
}

export function useAcademy() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("Academy components require DemoProvider.");
  return value;
}

export function DemoFeedback() {
  const { error, message, busy, feedbackPath } = useAcademy();
  const pathname = usePathname();
  if (pathname !== feedbackPath) return null;
  return <>
    <div role="alert">{error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}</div>
    <div role="status">{(busy || message) && <p className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">{busy ? "Saving your fictional demo changes…" : message}</p>}</div>
  </>;
}
