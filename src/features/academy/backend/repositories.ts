import { academyAccess, controlled, type AcademyPort, type Filters } from "./access";
import type {
  AcademyRole, Contact, ContactLink, DashboardCounts, DocumentReceipt, GroupRow, ImportBatch, ImportException, Month,
  ParentChildDetails, Plan, PrivateDetails, PublishedDocument, PublishedMonth, PublishedSubscription, SessionRow,
  Subscription, SwimmerRow, VerifiedChild, VerifiedGuardian,
} from "./contracts";
import {
  AcademyError, birthDate, choice, date, digest, documentStatuses, edit, flag, guardian, integer, invalid, levels,
  match, nullable, object, paymentStatuses, period, price, reviewReasons, swimmer, term, text, uuid, version,
} from "./validation";

interface Page { offset?: number; limit?: number }
const priced = "monthly_price_tnd::text";
const subscription = "id,swimmer_id," + priced + ",starts_on,ends_before,lifecycle";
const monthly = "subscription_id,billing_year,billing_month,normalized_status";
const swimmerColumns = "id,display_name,level,status,archived_at,row_version";
const documents = "document_type,status";

function scoped(port: AcademyPort, candidate: unknown, role: AcademyRole) {
  const access = () => academyAccess(port, candidate, role);
  async function rows<T>(table: string, columns: string, filters: Filters = {}, page?: Page, order = ["id"]) {
    const offset = integer(page?.offset ?? 0,"offset",0,1_000_000), limit = integer(page?.limit ?? 50,"limit",1,100);
    const { academy } = await access();
    return controlled(() => port.rows<T>(table, columns, { ...filters, academy_id: academy }, order, offset, limit));
  }
  async function rpc<T>(name: string, args: Filters, select?: string) {
    const { academy } = await access();
    return controlled(() => port.rpc<T>("academy_" + name, { ...args, p_academy: academy }, select));
  }
  return { access, rows, rpc };
}

export function adminRepository(port: AcademyPort, academyId: unknown) {
  const { access, rows, rpc } = scoped(port, academyId, "admin");
  const write = (name: string, args: Filters) => rpc<string>(name, args);
  return {
    listSwimmers: (page?: Page) => rows<SwimmerRow>("swimmers",swimmerColumns,{},page),
    async swimmerDetails(id: unknown) {
      const swimmerId = uuid(id);
      const [record] = await rows<SwimmerRow>("swimmers",swimmerColumns,{id:swimmerId},{limit:1});
      if (!record) return null;
      const [details] = await rows<PrivateDetails>("academy_admin_swimmer_private_details","swimmer_id,birth_date,row_version",{swimmer_id:swimmerId},{limit:1},["swimmer_id"]);
      return { swimmer: record, privateDetails: details ?? null };
    },
    async saveSwimmer(value: unknown) {
      const input = swimmer(value);
      if (!input.p_level) throw new AcademyError("level_review_required", "level");
      if (!input.p_id && input.p_archive) invalid("archived");
      return write("save_swimmer",input);
    },
    saveBirthDate: (id: unknown, day: unknown, expected?: unknown) => write("save_swimmer_birth_date",
      {p_swimmer:uuid(id),p_birth_date:nullable(day,birthDate),p_expected:nullable(expected,version)}),
    listContacts: (page?: Page) => rows<Contact>("academy_admin_guardian_contacts","id,display_name,phone,email,archived_at,row_version",{},page),
    listContactLinks: (id: unknown, page?: Page) => rows<ContactLink>("academy_admin_swimmer_guardian_contacts",
      "swimmer_id,contact_id",{swimmer_id:uuid(id)},page,["contact_id"]),
    listVerifiedGuardians: (id: unknown, page?: Page) => rows<VerifiedGuardian>("guardian_swimmers",
      "id,swimmer_id,parent_membership_id,verified_at,revoked_at,row_version",{swimmer_id:uuid(id)},page),
    saveContact: (value: unknown) => write("save_guardian_contact",guardian(value)),
    linkContact: (id: unknown, contact: unknown, linked: unknown) => write("link_guardian_contact",
      {p_swimmer:uuid(id),p_contact:uuid(contact),p_link:flag(linked,"linked")}),
    revokeVerifiedGuardian: (id: unknown) => rpc<null>("revoke_guardian",{p_relationship:uuid(id)}),
    listPlans: (page?: Page) => rows<Plan>("academy_admin_subscription_plans","id,code,label,"+priced+",active,row_version",{},page),
    savePlan(value: unknown) {
      const v = object(value);
      return write("save_subscription_plan",{...edit(v),p_code:match(v.code,"code",/^[A-Z0-9_-]{1,32}$/),p_label:text(v.label,"label",120),
        p_price:price(v.monthlyPriceTnd),p_active:flag(v.active,"active")});
    },
    listSubscriptions: (id: unknown, page?: Page) => rows<Subscription>("academy_admin_swimmer_subscriptions",
      subscription+",plan_id,parent_visible,row_version",{swimmer_id:uuid(id)},page),
    openSubscription(value: unknown) {
      const v = object(value);
      return write("open_subscription",{p_swimmer:uuid(v.swimmerId),p_plan:uuid(v.planId),...term(v.startsOn,v.endsBefore),p_confirmed:flag(v.confirmed,"confirmed")});
    },
    updateSubscription(value: unknown) {
      const v = object(value);
      return write("update_subscription_term",{p_id:uuid(v.id),p_expected:version(v.version),...term(v.startsOn,v.endsBefore),
        p_lifecycle:choice(v.lifecycle,"lifecycle",["review","confirmed","ended"])});
    },
    listMonths: (id: unknown, page?: Page) => rows<Month>("academy_admin_subscription_monthly_statuses",
      "id,"+monthly+",source_batch_id,source_code,parent_visible,row_version,correction_reason",{subscription_id:uuid(id)},page,["billing_year","billing_month","id"]),
    monthForPeriod: async (id: unknown, year: unknown, month: unknown) => {
      const {p_year,p_month}=period(year,month);
      const [record]=await rows<Month>("academy_admin_subscription_monthly_statuses",
        "id,"+monthly+",source_batch_id,source_code,parent_visible,row_version,correction_reason",
        {subscription_id:uuid(id),billing_year:p_year,billing_month:p_month},{limit:1});
      return record ?? null;
    },
    recordMonth(value: unknown) {
      const v = object(value);
      return write("record_monthly_status",{p_subscription:uuid(v.subscriptionId),...period(v.year,v.month),
        p_status:v.status === null ? null : choice(v.status,"status",paymentStatuses)});
    },
    correctMonth(value: unknown) {
      const v = object(value);
      return write("correct_monthly_status",{p_id:uuid(v.id),p_expected:version(v.version),p_status:v.status === null ? null : choice(v.status,"status",paymentStatuses),
        p_reason:choice(v.reason,"reason",["source_review","admin_correction"])});
    },
    listDocuments: (id: unknown, page?: Page) => rows<DocumentReceipt>("academy_admin_registration_document_statuses",
      "id,swimmer_id,"+documents+",source_batch_id,source_code,parent_visible,row_version",{swimmer_id:uuid(id)},page),
    saveDocument(value: unknown) {
      const v = object(value);
      return write("save_document_status",{p_swimmer:uuid(v.swimmerId),p_type:match(v.type,"documentType",/^[a-z][a-z0-9_]{0,39}$/),
        p_expected:nullable(v.version,version),p_status:choice(v.status,"status",documentStatuses)});
    },
    publish(kind: unknown, id: unknown, expected: unknown, visible: unknown) {
      return write("publish_subscription_record",{p_kind:choice(kind,"kind",["subscription","month","document"]),
        p_id:uuid(id),p_expected:version(expected),p_visible:flag(visible,"visible")});
    },
    listImportBatches: (page?: Page) => rows<ImportBatch>("academy_admin_import_batches",
      "id,billing_year,state,preview_digest,source_digest,mapping_version,selection_digest,row_version",{},page),
    listImportExceptions: (id: unknown, page?: Page) => rows<ImportException>("academy_admin_import_review_items",
      "id,batch_id,source_row_key,reason_code,resolution,row_version",{batch_id:uuid(id)},page),
    createImportReview(value: unknown) {
      const v = object(value);
      return write("create_import_review",{p_source_digest:digest(v.sourceDigest),p_preview_digest:digest(v.previewDigest),
        p_mapping_version:match(v.mappingVersion,"mappingVersion",/^\d{1,6}(?:\.\d{1,6}){0,3}$/),
        p_billing_year:nullable(v.year,y=>period(y,1).p_year)});
    },
    quarantineImportRow: (batch: unknown, row: unknown, reason: unknown) => write("quarantine_import_row",
      {p_batch:uuid(batch),p_row:uuid(row),p_reason:choice(reason,"reason",reviewReasons)}),
    resolveImportException: (id: unknown, expected: unknown, resolution: unknown) => write("resolve_import_exception",
      {p_id:uuid(id),p_expected:version(expected),p_resolution:choice(resolution,"resolution",["resolved","excluded"])}),
    approveImportReview(value: unknown) {
      const v = object(value);
      return write("approve_import_review",{p_batch:uuid(v.batchId),p_expected:version(v.version),p_preview_digest:digest(v.previewDigest),
        p_selection_digest:digest(v.selectionDigest),p_includes_months:flag(v.includesMonths,"includesMonths")});
    },
    listGroups: (page?: Page) => rows<GroupRow>("groups","id,name,level,capacity,schedule_label,archived_at,row_version",{},page),
    saveGroup(value: unknown) {
      const v = object(value);
      return write("save_group",{...edit(v),p_name:text(v.name,"name",60),p_level:choice(v.level,"level",levels),
        p_capacity:integer(v.capacity,"capacity",1,50),p_schedule:nullable(v.schedule,s=>text(s,"schedule",100)),p_archive:flag(v.archived ?? false,"archived")});
    },
    transferSwimmer: (id: unknown, group: unknown, from: unknown, until?: unknown) => {
      const { p_starts, p_ends } = term(date(from),until);
      return write("transfer_swimmer",{p_swimmer:uuid(id),p_group:uuid(group),p_from:p_starts,p_until:p_ends});
    },
    listSessions: (id: unknown, page?: Page) => rows<SessionRow>("sessions",
      "id,group_id,session_date,status,starts_at,ends_at,row_version",{group_id:uuid(id)},page,["session_date","id"]),
    createSession: (id: unknown, day: unknown) => write("create_session",{p_group:uuid(id),p_day:date(day)}),
    setSessionStatus: (id: unknown, status: unknown, expected: unknown) => rpc<null>("session_status",
      {p_session:uuid(id),p_status:choice(status,"status",["open","closed","cancelled"]),p_expected:version(expected)}),
    markAttendance(value: unknown) {
      const v = object(value);
      return rpc<{ status: string | null; version: number | null; changed: boolean }>("mark_attendance",{
        p_session:uuid(v.sessionId),p_swimmer:uuid(v.swimmerId),p_request:uuid(v.requestId),p_expected:integer(v.version,"version",0),
        p_status:v.status === null ? null : choice(v.status,"status",["present","absent","excused"]),p_reason:nullable(v.reason,s=>text(s,"reason",160))});
    },
    async dashboard(year: unknown, month: unknown): Promise<DashboardCounts> {
      const {p_year,p_month} = period(year,month);
      const { academy } = await access();
      const count = (table: string, filters: Filters) => controlled(() => port.count(table,{...filters,academy_id:academy}));
      const [swimmers,groups,confirmedSubscriptions,openImportExceptions,...statuses] = await Promise.all([
        count("swimmers",{archived_at:null}),count("groups",{archived_at:null}),
        count("academy_admin_swimmer_subscriptions",{lifecycle:"confirmed"}),count("academy_admin_import_review_items",{resolution:"open"}),
        ...[...paymentStatuses,null].map(normalized_status => count("academy_admin_subscription_monthly_statuses",{billing_year:p_year,billing_month:p_month,normalized_status})),
      ]);
      return {swimmers,groups,confirmedSubscriptions,openImportExceptions,recordedMonthlyStatuses:
        {paid:statuses[0],pending:statuses[1],unpaid:statuses[2],unknown:statuses[3],blank:statuses[4]}};
    },
  };
}

export function parentRepository(port: AcademyPort, academyId: unknown) {
  const { access, rpc } = scoped(port,academyId,"parent");
  return {
    async listVerifiedChildren(page?: Page): Promise<VerifiedChild[]> {
      const offset = integer(page?.offset ?? 0,"offset",0,1_000_000), limit = integer(page?.limit ?? 50,"limit",1,100);
      const { academy, membership } = await access();
      const result = await controlled(() => port.rows<{relationship:VerifiedChild["relationship"];swimmers:Omit<VerifiedChild,"relationship">}>(
        "guardian_swimmers","relationship,swimmers!inner(id,display_name,level)",
        {academy_id:academy,parent_membership_id:membership,revoked_at:null},["id"],offset,limit));
      return result.map(row=>({...row.swimmers,relationship:row.relationship}));
    },
    async publishedChildDetails(id: unknown): Promise<ParentChildDetails> {
      const p_swimmer = uuid(id);
      const [subscriptions,monthlyStatuses,receipts] = await Promise.all([
        rpc<PublishedSubscription[]>("parent_subscriptions",{p_swimmer},subscription),
        rpc<PublishedMonth[]>("parent_months",{p_swimmer},monthly),
        rpc<PublishedDocument[]>("parent_documents",{p_swimmer},documents),
      ]);
      return {subscriptions,monthlyStatuses,documents:receipts};
    },
  };
}

