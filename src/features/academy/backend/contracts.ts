import type { documentStatuses, levels, paymentStatuses, Tnd } from "./validation";

export type AcademyRole = "admin" | "parent";
export type Level = (typeof levels)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type DocumentStatus = (typeof documentStatuses)[number];
export interface Versioned { id: string; row_version: number }
export interface SwimmerRow extends Versioned { display_name: string; level: Level; status: "active" | "trial"; archived_at: string | null }
export interface GroupRow extends Versioned { name: string; level: Level; capacity: number; schedule_label: string | null; archived_at: string | null }
export interface Contact extends Versioned { display_name: string; phone: string | null; email: string | null; archived_at: string | null }
export interface ContactLink { swimmer_id: string; contact_id: string }
export interface PrivateDetails { swimmer_id: string; birth_date: string | null; row_version: number }
export interface VerifiedGuardian extends Versioned { swimmer_id: string; parent_membership_id: string; verified_at: string; revoked_at: string | null }
export interface Plan extends Versioned { code: string; label: string; monthly_price_tnd: Tnd; active: boolean }
export interface PublishedSubscription { id: string; swimmer_id: string; monthly_price_tnd: Tnd; starts_on: string | null; ends_before: string | null; lifecycle: "review" | "confirmed" | "ended" }
export interface Subscription extends PublishedSubscription, Versioned { plan_id: string; parent_visible: boolean }
export interface PublishedMonth { subscription_id: string; billing_year: number; billing_month: number; normalized_status: PaymentStatus | null }
export interface Month extends PublishedMonth, Versioned { source_batch_id: string | null; source_code: string | null; parent_visible: boolean; correction_reason: string | null }
export interface PublishedDocument { document_type: string; status: DocumentStatus }
export interface DocumentReceipt extends PublishedDocument, Versioned { swimmer_id: string; source_batch_id: string | null; source_code: string | null; parent_visible: boolean }
export interface ImportBatch extends Versioned { billing_year: number | null; state: "review" | "approved"; preview_digest: string; source_digest: string; mapping_version: string; selection_digest: string | null }
export interface ImportException extends Versioned { batch_id: string; source_row_key: string; reason_code: string; resolution: "open" | "resolved" | "excluded" }
export interface SessionRow extends Versioned { group_id: string; session_date: string; status: string; starts_at: string | null; ends_at: string | null }
export interface DashboardCounts { swimmers: number; groups: number; confirmedSubscriptions: number; openImportExceptions: number; recordedMonthlyStatuses: Record<PaymentStatus | "blank", number> }
export interface VerifiedChild { id: string; display_name: string; level: Level; relationship: "parent" | "legal_guardian" }
export interface ParentChildDetails { subscriptions: PublishedSubscription[]; monthlyStatuses: PublishedMonth[]; documents: PublishedDocument[] }


export interface CoachRow extends Versioned { display_name: string; membership_id: string | null; archived_at: string | null }
export interface Assignment extends Versioned { group_id: string; valid_from: string; valid_until: string | null; cancelled_at: string | null }
export interface CoachAssignment extends Assignment { coach_id: string; is_primary: boolean }
export interface SwimmerAssignment extends Assignment { swimmer_id: string }
export interface AttendanceRevision { id: string; session_id: string; swimmer_id: string; revision: number; previous_status: string | null; new_status: string | null; reason: string | null; created_at: string }
export interface SwimmerNote extends Versioned { swimmer_id: string; session_id: string | null; body: string; visibility: "internal" | "parent_visible"; deleted_at: string | null }
