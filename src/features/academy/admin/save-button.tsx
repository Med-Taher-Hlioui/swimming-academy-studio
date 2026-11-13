"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
export function SaveButton({children="Save"}:{children?:ReactNode}) {
  const {pending}=useFormStatus();
  return <button className="button justify-self-start disabled:opacity-60" disabled={pending} aria-disabled={pending}>{pending?"Saving…":children}</button>;
}
