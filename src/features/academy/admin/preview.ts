import { AcademyError, digest, integer, object } from "../backend/validation";

const reasons = ["skill_level_required","missing_swimmer_identity","guardian_phone_review","guardian_contact_review",
  "ambiguous_birth_date","invalid_start_date","invalid_plan","invalid_payment_marker","subscription_period_review",
  "invalid_document_marker","duplicate_swimmer_candidate","duplicate_guardian_candidate"] as const;
export type DryRun = {
  rows:number; quarantined:number; accepted:number; issues:{category:string;count:number}[];
};
export function readDryRun(raw:unknown):DryRun {
  if(typeof raw!=="string" || raw.length>12_000) throw new AcademyError("invalid_input");
  let report;
  try { report=object(JSON.parse(raw)); } catch { throw new AcademyError("invalid_input"); }
  if(report.mode!=="dry-run" || report.billingYear!==2026 || report.mappingVersion!=="2.0" || report.appliedRows!==0) throw new AcademyError("invalid_input");
  digest(report.sourceDigest); digest(report.previewDigest);
  const rows=integer(report.rows,"rows",0,5000), quarantined=integer(report.quarantinedRows,"quarantinedRows",0,rows);
  const values=object(report.reasons);
  if(Object.keys(values).some(key=>!reasons.some(reason=>reason===key))) throw new AcademyError("invalid_input");
  const issues=reasons.filter(category=>Object.hasOwn(values,category)).map(category=>({category,count:integer(values[category],category,1,quarantined)}));
  if((quarantined>0)!==(issues.length>0) || issues.reduce((sum,i)=>sum+i.count,0)<quarantined) throw new AcademyError("invalid_input");
  return {rows,quarantined,accepted:rows-quarantined,issues};
}

