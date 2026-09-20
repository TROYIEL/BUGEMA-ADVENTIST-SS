import "server-only";

import { ContentStatus, EnquiryStatus, StudyLevel } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { MEDIA_SELECT } from "./content";
import { uniqueSlug, type ContentFilters, type ContentListRow } from "./content-admin";
import { escapeHtml, getNotificationAddress, sendMail } from "./mail";
import { richTextToPlainText, sanitizeRichText, truncate } from "./sanitize";
import { getSiteSettings, readSetting } from "./settings";
import { indexDocument, removeFromIndex } from "./search";

/**
 * The school itself, from the staff side: programmes, departments and
 * subjects; staff profiles; and the enquiries the contact form sends in.
 */

function textSearch(q: string | undefined, fields: string[]) {
  const trimmed = q?.trim();
  if (!trimmed) return undefined;
  return fields.map((field) => ({ [field]: { contains: trimmed, mode: "insensitive" as const } }));
}

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

const PROGRAM_SELECT = {
  id: true,
  slug: true,
  title: true,
  level: true,
  summary: true,
  body: true,
  imageId: true,
  order: true,
  status: true,
  updatedAt: true,
  image: { select: MEDIA_SELECT },
} satisfies Prisma.AcademicProgramSelect;

export type ProgramRow = Prisma.AcademicProgramGetPayload<{ select: typeof PROGRAM_SELECT }>;

export async function listPrograms(filters: ContentFilters = {}): Promise<(ContentListRow & { order: number })[]> {
  const rows = await db.academicProgram.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}), OR: textSearch(filters.q, ["title"]) },
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, status: true, level: true, order: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    meta: LEVEL_WORDS[row.level],
    updatedAt: row.updatedAt,
    publishedAt: null,
    order: row.order,
  }));
}

export async function getProgram(id: string): Promise<ProgramRow | null> {
  return db.academicProgram.findUnique({ where: { id }, select: PROGRAM_SELECT });
}

export type ProgramInput = {
  title: string;
  slug: string;
  level: StudyLevel;
  summary: string | null;
  body: string | null;
  imageId: string | null;
  status: ContentStatus;
};

export async function saveProgram(id: string | null, input: ProgramInput): Promise<{ id: string }> {
  const data = { ...input, slug: await uniqueSlug("academicProgram", input.slug, id), body: input.body ? sanitizeRichText(input.body) : null };
  const select = { id: true, slug: true, title: true, summary: true, body: true, status: true };
  const saved = id
    ? await db.academicProgram.update({ where: { id }, data, select })
    : await db.academicProgram.create({ data: { ...data, order: ((await db.academicProgram.aggregate({ _max: { order: true } }))._max.order ?? 0) + 10 }, select });
  if (saved.status === ContentStatus.PUBLISHED) {
    await indexDocument({
      entityType: "program",
      entityId: saved.id,
      title: saved.title,
      excerpt: saved.summary ?? truncate(richTextToPlainText(saved.body), 240),
      keywords: richTextToPlainText(saved.body).slice(0, 2000),
      url: `/academics/programmes/${saved.slug}`,
    });
  } else {
    await removeFromIndex("program", saved.id);
  }
  return { id: saved.id };
}

export async function deleteProgram(id: string): Promise<void> {
  await db.academicProgram.delete({ where: { id } });
  await removeFromIndex("program", id);
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const DEPARTMENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  body: true,
  imageId: true,
  headId: true,
  order: true,
  status: true,
  updatedAt: true,
  image: { select: MEDIA_SELECT },
  head: { select: { id: true, name: true } },
  _count: { select: { subjects: true } },
} satisfies Prisma.AcademicDepartmentSelect;

export type DepartmentRow = Prisma.AcademicDepartmentGetPayload<{ select: typeof DEPARTMENT_SELECT }>;

export async function listDepartments(filters: ContentFilters = {}): Promise<(ContentListRow & { order: number })[]> {
  const rows = await db.academicDepartment.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}), OR: textSearch(filters.q, ["name"]) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, status: true, order: true, updatedAt: true, head: { select: { name: true } }, _count: { select: { subjects: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    slug: row.slug,
    status: row.status,
    meta: [row.head ? `Head: ${row.head.name}` : null, `${row._count.subjects} ${row._count.subjects === 1 ? "subject" : "subjects"}`].filter(Boolean).join(" · "),
    updatedAt: row.updatedAt,
    publishedAt: null,
    order: row.order,
  }));
}

export async function getDepartment(id: string): Promise<DepartmentRow | null> {
  return db.academicDepartment.findUnique({ where: { id }, select: DEPARTMENT_SELECT });
}

export type DepartmentInput = {
  name: string;
  slug: string;
  description: string | null;
  body: string | null;
  imageId: string | null;
  headId: string | null;
  status: ContentStatus;
};

export async function saveDepartment(id: string | null, input: DepartmentInput): Promise<{ id: string }> {
  const data = { ...input, slug: await uniqueSlug("academicDepartment", input.slug, id), body: input.body ? sanitizeRichText(input.body) : null };
  const select = { id: true, slug: true, name: true, description: true, body: true, status: true };
  const saved = id
    ? await db.academicDepartment.update({ where: { id }, data, select })
    : await db.academicDepartment.create({ data: { ...data, order: ((await db.academicDepartment.aggregate({ _max: { order: true } }))._max.order ?? 0) + 10 }, select });
  if (saved.status === ContentStatus.PUBLISHED) {
    await indexDocument({
      entityType: "department",
      entityId: saved.id,
      title: saved.name,
      excerpt: saved.description ?? truncate(richTextToPlainText(saved.body), 240),
      keywords: richTextToPlainText(saved.body).slice(0, 2000),
      url: `/academics/departments/${saved.slug}`,
    });
  } else {
    await removeFromIndex("department", saved.id);
  }
  return { id: saved.id };
}

/** Subjects keep their rows (department set to none); nothing else refers to a department. */
export async function deleteDepartment(id: string): Promise<void> {
  await db.academicDepartment.delete({ where: { id } });
  await removeFromIndex("department", id);
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

const SUBJECT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  departmentId: true,
  teacherId: true,
  level: true,
  isCore: true,
  order: true,
  status: true,
  department: { select: { name: true } },
  teacher: { select: { name: true } },
} satisfies Prisma.SubjectSelect;

export type SubjectRow = Prisma.SubjectGetPayload<{ select: typeof SUBJECT_SELECT }>;

export async function listSubjects(): Promise<SubjectRow[]> {
  return db.subject.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: SUBJECT_SELECT });
}

export type SubjectInput = {
  name: string;
  description: string | null;
  departmentId: string | null;
  teacherId: string | null;
  level: StudyLevel;
  isCore: boolean;
  status: ContentStatus;
};

export async function saveSubject(id: string | null, input: SubjectInput, slug: string): Promise<{ id: string }> {
  const data = { ...input, slug: await uniqueSlug("subject", slug, id) };
  const select = { id: true, slug: true, name: true, description: true, status: true };
  const saved = id
    ? await db.subject.update({ where: { id }, data, select })
    : await db.subject.create({ data: { ...data, order: ((await db.subject.aggregate({ _max: { order: true } }))._max.order ?? 0) + 10 }, select });
  if (saved.status === ContentStatus.PUBLISHED) {
    await indexDocument({ entityType: "subject", entityId: saved.id, title: saved.name, excerpt: saved.description, keywords: null, url: `/academics/subjects#${saved.slug}` });
  } else {
    await removeFromIndex("subject", saved.id);
  }
  return { id: saved.id };
}

export async function deleteSubject(id: string): Promise<void> {
  await db.subject.delete({ where: { id } });
  await removeFromIndex("subject", id);
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

type SchoolOrdered = "academicProgram" | "academicDepartment" | "subject" | "staffProfile";

export async function moveSchoolRow(model: SchoolOrdered, id: string, direction: "up" | "down"): Promise<void> {
  const orderBy = [{ order: "asc" as const }, { createdAt: "asc" as const }];
  const rows =
    model === "academicProgram"
      ? await db.academicProgram.findMany({ orderBy, select: { id: true } })
      : model === "academicDepartment"
        ? await db.academicDepartment.findMany({ orderBy, select: { id: true } })
        : model === "subject"
          ? await db.subject.findMany({ orderBy, select: { id: true } })
          : await db.staffProfile.findMany({ orderBy, select: { id: true } });
  const ids = rows.map((row) => row.id);
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  await db.$transaction(
    ids.map((rowId, position) => {
      const data = { order: (position + 1) * 10 };
      switch (model) {
        case "academicProgram":
          return db.academicProgram.update({ where: { id: rowId }, data });
        case "academicDepartment":
          return db.academicDepartment.update({ where: { id: rowId }, data });
        case "subject":
          return db.subject.update({ where: { id: rowId }, data });
        case "staffProfile":
          return db.staffProfile.update({ where: { id: rowId }, data });
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const STAFF_SELECT = {
  id: true,
  name: true,
  position: true,
  department: true,
  bio: true,
  email: true,
  phone: true,
  photoId: true,
  order: true,
  isVisible: true,
  isLeadership: true,
  updatedAt: true,
  photo: { select: MEDIA_SELECT },
  _count: { select: { headedDepartments: true, taughtSubjects: true } },
} satisfies Prisma.StaffProfileSelect;

export type StaffRow = Prisma.StaffProfileGetPayload<{ select: typeof STAFF_SELECT }>;

export async function listStaff(q?: string): Promise<StaffRow[]> {
  return db.staffProfile.findMany({
    where: { OR: textSearch(q, ["name", "position", "department"]) },
    orderBy: [{ isLeadership: "desc" }, { order: "asc" }, { name: "asc" }],
    select: STAFF_SELECT,
  });
}

/** For pickers: who can head a department or teach a subject. */
export async function listStaffChoices(): Promise<{ id: string; name: string; position: string }[]> {
  return db.staffProfile.findMany({ orderBy: [{ name: "asc" }], select: { id: true, name: true, position: true } });
}

export async function getStaff(id: string): Promise<StaffRow | null> {
  return db.staffProfile.findUnique({ where: { id }, select: STAFF_SELECT });
}

export type StaffInput = {
  name: string;
  position: string;
  department: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  photoId: string | null;
  isVisible: boolean;
  isLeadership: boolean;
};

export async function saveStaff(id: string | null, input: StaffInput): Promise<{ id: string }> {
  if (id) {
    await db.staffProfile.update({ where: { id }, data: input });
    return { id };
  }
  return db.staffProfile.create({
    data: { ...input, order: ((await db.staffProfile.aggregate({ _max: { order: true } }))._max.order ?? 0) + 10 },
    select: { id: true },
  });
}

/** Departments they head and subjects they teach are unlinked, not removed. */
export async function deleteStaff(id: string): Promise<void> {
  await db.staffProfile.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

const ENQUIRY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  body: true,
  status: true,
  readAt: true,
  createdAt: true,
  handledBy: { select: { name: true } },
} satisfies Prisma.ContactEnquirySelect;

export type EnquiryRow = Prisma.ContactEnquiryGetPayload<{ select: typeof ENQUIRY_SELECT }>;

export const ENQUIRY_PAGE_SIZE = 25;

export async function listEnquiries(
  filters: { status?: EnquiryStatus; q?: string },
  page: number,
): Promise<{ rows: EnquiryRow[]; total: number; totalPages: number; counts: Record<EnquiryStatus, number> }> {
  const where: Prisma.ContactEnquiryWhereInput = {
    ...(filters.status ? { status: filters.status } : { status: { not: EnquiryStatus.SPAM } }),
    OR: textSearch(filters.q, ["name", "email", "subject", "body"]),
  };
  const [rows, total, groups] = await Promise.all([
    db.contactEnquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * ENQUIRY_PAGE_SIZE, take: ENQUIRY_PAGE_SIZE, select: ENQUIRY_SELECT }),
    db.contactEnquiry.count({ where }),
    db.contactEnquiry.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(Object.values(EnquiryStatus).map((status) => [status, 0])) as Record<EnquiryStatus, number>;
  for (const group of groups) counts[group.status] = group._count._all;
  return { rows, total, totalPages: Math.max(1, Math.ceil(total / ENQUIRY_PAGE_SIZE)), counts };
}

export async function getEnquiry(id: string): Promise<EnquiryRow | null> {
  return db.contactEnquiry.findUnique({ where: { id }, select: ENQUIRY_SELECT });
}

/** Opening an unread enquiry marks it read, by whoever opened it. */
export async function markEnquiryRead(id: string, userId: string): Promise<void> {
  await db.contactEnquiry.updateMany({
    where: { id, status: EnquiryStatus.UNREAD },
    data: { status: EnquiryStatus.READ, readAt: new Date(), handledById: userId },
  });
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus, userId: string): Promise<void> {
  await db.contactEnquiry.update({
    where: { id },
    data: {
      status,
      handledById: userId,
      // Back to unread clears the read time; any other change keeps it.
      ...(status === EnquiryStatus.UNREAD ? { readAt: null } : {}),
    },
  });
}

export async function deleteEnquiry(id: string): Promise<void> {
  await db.contactEnquiry.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

const REPLY_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  sentBy: { select: { name: true } },
  outbox: { select: { id: true, status: true, sentAt: true, lastError: true, toAddress: true } },
} satisfies Prisma.EnquiryReplySelect;

export type EnquiryReplyRow = Prisma.EnquiryReplyGetPayload<{ select: typeof REPLY_SELECT }>;

export async function listEnquiryReplies(enquiryId: string): Promise<EnquiryReplyRow[]> {
  return db.enquiryReply.findMany({ where: { enquiryId }, orderBy: { createdAt: "asc" }, select: REPLY_SELECT });
}

export const REPLY_MAX_LENGTH = 5000;

/**
 * Answers an enquiry from the admin: the reply is recorded first, then
 * emailed to the person who wrote in, with the school's own address as
 * Reply-To so their answer comes back to a real inbox rather than to
 * no-reply. The enquiry moves to "replied" whatever it was before, unless it
 * had been filed as spam or archived.
 *
 * Returns the reply together with whether the email actually left; a mail
 * failure is recorded on the outbox row and shown on the thread, never
 * thrown — the reply text must not be lost because SMTP was down.
 */
export async function replyToEnquiry(
  enquiryId: string,
  body: string,
  userId: string,
): Promise<{ reply: EnquiryReplyRow; delivered: boolean } | null> {
  const enquiry = await db.contactEnquiry.findUnique({
    where: { id: enquiryId },
    select: { id: true, name: true, email: true, subject: true, body: true, status: true, createdAt: true },
  });
  if (!enquiry) return null;

  const sender = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  const settings = await getSiteSettings();
  const schoolName = readSetting(settings, "school.name") ?? "the school";
  // Where the parent's answer should land: the enquiries inbox if the school
  // named one, otherwise the general address.
  const replyTo = (await getNotificationAddress("enquiry")) ?? readSetting(settings, "contact.email") ?? undefined;

  const text =
    `${body.trim()}\n\n` +
    `${sender?.name ?? "The school office"}\n${schoolName}\n\n` +
    `----\nOn ${enquiry.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Kampala" })}, you wrote:\n` +
    enquiry.body
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");

  const paragraph = (value: string) =>
    value
      .trim()
      .split(/\n{2,}/)
      .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, "<br>")}</p>`)
      .join("");

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#171a1f">` +
    paragraph(body) +
    `<p style="margin-top:1.5em">${escapeHtml(sender?.name ?? "The school office")}<br>${escapeHtml(schoolName)}</p>` +
    `<hr style="border:0;border-top:1px solid #d9dde3;margin:1.5em 0">` +
    `<p style="color:#5f656e;font-size:13px">On ${escapeHtml(enquiry.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Kampala" }))}, you wrote:</p>` +
    `<blockquote style="margin:0;padding-left:1em;border-left:3px solid #d9dde3;color:#5f656e;font-size:13px">${paragraph(enquiry.body)}</blockquote>` +
    `</div>`;

  const mail = await sendMail({
    to: enquiry.email,
    toName: enquiry.name,
    replyTo,
    subject: enquiry.subject.toLowerCase().startsWith("re:") ? enquiry.subject : `Re: ${enquiry.subject}`,
    html,
    text,
    relatedType: "contact_enquiry",
    relatedId: enquiry.id,
  });

  const [reply] = await Promise.all([
    db.enquiryReply.create({
      data: { enquiryId: enquiry.id, body: body.trim(), sentById: userId, outboxId: mail.id },
      select: REPLY_SELECT,
    }),
    enquiry.status === EnquiryStatus.SPAM || enquiry.status === EnquiryStatus.ARCHIVED
      ? db.contactEnquiry.update({ where: { id: enquiry.id }, data: { handledById: userId } })
      : db.contactEnquiry.update({
          where: { id: enquiry.id },
          data: { status: EnquiryStatus.REPLIED, handledById: userId, readAt: enquiry.status === EnquiryStatus.UNREAD ? new Date() : undefined },
        }),
  ]);

  return { reply, delivered: mail.delivered };
}

export const LEVEL_WORDS: Record<StudyLevel, string> = {
  [StudyLevel.O_LEVEL]: "O-level",
  [StudyLevel.A_LEVEL]: "A-level",
  [StudyLevel.BOTH]: "O- and A-level",
};
