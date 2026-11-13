export type Failure = "invalid_input" | "level_review_required" | "unauthenticated" | "forbidden" | "conflict" | "unavailable";
export class AcademyError extends Error {
  constructor(readonly code: Failure, readonly field?: string) {
    super(code);
    this.name = "AcademyError";
  }
}
export function invalid(field: string): never { throw new AcademyError("invalid_input", field); }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("input");
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) invalid(field);
  return value.trim();
}
export function match(value: unknown, field: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) invalid(field);
  return value;
}
export const uuid = (value: unknown, field = "id") =>
  match(value, field, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i).toLowerCase();
export const digest = (value: unknown) => match(value, "digest", /^[a-f0-9]{64}$/);
export function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value == null || value === "" ? null : parse(value);
}
export function choice<const T extends readonly string[]>(value: unknown, field: string, choices: T): T[number] {
  if (typeof value !== "string" || !choices.includes(value)) invalid(field);
  return value as T[number];
}
export function integer(value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid(field);
  return value;
}
export function flag(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") invalid(field);
  return value;
}
export function date(value: unknown, field = "date"): string {
  const day = match(value, field, /^(?!0000)\d{4}-\d{2}-\d{2}$/);
  const timestamp = Date.parse(day + "T00:00:00Z");
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,10) !== day) invalid(field);
  return day;
}
export function birthDate(value: unknown, today = new Date().toISOString().slice(0,10)): string {
  const day = date(value, "birthDate");
  if (day > today) invalid("birthDate");
  return day;
}
export function term(starts: unknown, ends: unknown) {
  const p_starts = nullable(starts, date), p_ends = nullable(ends, date);
  if (p_starts && p_ends && p_starts >= p_ends) invalid("endsBefore");
  return { p_starts, p_ends };
}
export function period(year: unknown, month: unknown) {
  return { p_year: integer(year, "billingYear", 1, 9999), p_month: integer(month, "billingMonth", 1, 12) };
}
export function phone(value: unknown, country?: "TN"): string {
  const raw = text(value, "phone", 40);
  if (!/^\+?[\d .()-]+$/.test(raw)) invalid("phone");
  let result = raw.replace(/[ .()-]/g, "");
  if (result.startsWith("00")) result = "+" + result.slice(2);
  if (country === "TN" && /^\d{8}$/.test(result)) result = "+216" + result;
  return match(result, "phone", /^\+[1-9][0-9]{7,14}$/);
}
export type Tnd = string & { readonly __tnd: unique symbol };
export function price(value: unknown): Tnd {
  const decimal = match(value, "monthlyPriceTnd", /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/);
  const [whole, fraction = ""] = decimal.split(".");
  return (whole + "." + fraction.padEnd(3, "0")) as Tnd;
}
export const levels = ["beginner", "developing", "advanced"] as const;
export const paymentStatuses = ["paid", "pending", "unpaid", "unknown"] as const;
export const documentStatuses = ["received", "unknown", "missing", "rejected"] as const;
export const reviewReasons = ["ambiguous_identity","duplicate_candidate","missing_required","invalid_value","billing_year_required","subscription_conflict"] as const;
export const version = (value: unknown) => integer(value, "version", 1);
export function edit(input: Record<string, unknown>) {
  const p_id = nullable(input.id, uuid), p_expected = nullable(input.version, version);
  if ((p_id === null) !== (p_expected === null)) invalid("version");
  return { p_id, p_expected };
}
export function swimmer(value: unknown) {
  const input = object(value);
  return { ...edit(input), p_name: text(input.name,"name",160),
    p_level: nullable(input.level, v => choice(v,"level",levels)),
    p_status: choice(input.status,"status",["active","trial"]),
    p_archive: flag(input.archived ?? false,"archived") };
}
export function guardian(value: unknown) {
  const input = object(value);
  return { ...edit(input), p_name: text(input.name,"name",160),
    p_phone: nullable(input.phone, v => phone(v, input.phoneCountry === "TN" ? "TN" : undefined)),
    p_email: nullable(input.email, v => match(text(v,"email",254),"email",/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
    p_archived: flag(input.archived ?? false,"archived") };
}
export function databaseFailure(code?: string): AcademyError {
  if (code === "42501" || code === "PGRST301") return new AcademyError("forbidden");
  if (["40001","23505","23P01","23503"].includes(code ?? "")) return new AcademyError("conflict");
  if (["23502","23514","22003","22P02","22007","22008"].includes(code ?? "")) return new AcademyError("invalid_input");
  return new AcademyError("unavailable");
}
