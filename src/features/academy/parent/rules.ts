export const isUuid = (value:string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const invitationToken = (value:unknown):value is string => typeof value==="string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export const authDestination = (intent:unknown) => intent==="invite" ? "/parent/invite" : "/parent";
export function statusLabel(status:string|null) {
  if(status===null)return "Blank — no source value";
  switch(status){case "paid":return "Paid";case "pending":return "Pending";case "unpaid":return "Unpaid";default:return "Unknown";}
}
export function isCurrentTerm(term:{starts_on:string|null;ends_before:string|null;lifecycle:string},today:string) {
  return term.lifecycle==="confirmed"&&(!term.starts_on||term.starts_on<=today)&&(!term.ends_before||today<term.ends_before);
}

