"use server";
import { openAdmin } from "./access";
import { readDryRun, type DryRun } from "./preview";
import { AcademyError } from "../backend/validation";

type State = { preview?:DryRun; error?:string };
export async function reviewPreview(_previous:State, form:FormData):Promise<State> {
  try {
    await openAdmin();
    return {preview:readDryRun(form.get("summary"))};
  } catch(error) {
    if(error instanceof AcademyError && error.code==="invalid_input") return {error:"Use the redacted JSON output of the Phase 2 dry run."};
    return {error:"An active Admin session is required to review this report."};
  }
}

