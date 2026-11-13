import type { Assignment } from "../backend/contracts";
export function academyDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Tunis",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
export function assignedOn(row: Assignment, day: string) {
  return !row.cancelled_at && row.valid_from<=day && (!row.valid_until||day<row.valid_until);
}
// Read every page for operational rosters; never silently omit the 101st assignment.
export async function allRecords<T>(load:(page:{offset:number;limit:number})=>Promise<T[]>):Promise<T[]> {
  const result:T[]=[];
  for(let offset=0;;offset+=100){const page=await load({offset,limit:100});result.push(...page);if(page.length<100)return result;}
}
