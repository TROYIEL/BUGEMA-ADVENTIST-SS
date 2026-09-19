import "dotenv/config";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { ApplicationStatus, ApplicationStep, StudyLevel } from "@/generated/prisma/enums";
import { createPrismaClient } from "@/lib/db/client";

import {
  canApplicantUpload,
  createDraft,
  finaliseSubmission,
  findDraft,
  furthestStep,
  stepAfter,
  validateForSubmission,
  visibleSteps,
  type ApplicationConfig,
  type DraftApplication,
} from "./applications";

const db = createPrismaClient();

// A counter year no real submission will ever use.
const TEST_YEAR = 9000 + Math.floor(Math.random() * 900);
let academicYearId: string;
const draftIds: string[] = [];

before(async () => {
  const year = await db.academicYear.create({
    data: { name: `test-${TEST_YEAR}-${Math.random().toString(36).slice(2, 8)}` },
    select: { id: true },
  });
  academicYearId = year.id;
});

after(async () => {
  await db.application.deleteMany({ where: { id: { in: draftIds } } });
  await db.academicYear.delete({ where: { id: academicYearId } });
  await db.applicationCounter.deleteMany({ where: { year: TEST_YEAR } });
  await db.$disconnect();
});

describe("reference numbers", () => {
  it("hands out consecutive, unique numbers under concurrent submissions", async () => {
    // Twenty-five real drafts submitted at the same instant. This is the case
    // that failed on a pooled database when the critical section was an
    // interactive transaction; it must pass through Neon's pooler.
    const drafts = await Promise.all(
      Array.from({ length: 25 }, () => createDraft(academicYearId)),
    );
    draftIds.push(...drafts.map((draft) => draft.id));

    const references = await Promise.all(
      drafts.map((draft) =>
        finaliseSubmission({
          applicationId: draft.id,
          year: TEST_YEAR,
          accessTokenHash: `test-${draft.id}`,
          contactEmail: null,
          contactPhone: null,
        }),
      ),
    );

    const issued = references.filter((ref): ref is string => ref !== null);
    assert.equal(issued.length, 25, "every draft must receive a reference");
    assert.equal(new Set(issued).size, 25, "every reference must be distinct");

    const sequences = issued.map((ref) => Number(ref.split("-")[2])).sort((a, b) => a - b);
    assert.deepEqual(
      sequences,
      Array.from({ length: 25 }, (_, index) => index + 1),
      "the sequence must have no gaps and no repeats",
    );
    assert.match(issued[0]!, new RegExp(`^BASS-${TEST_YEAR}-\\d{6}$`));

    const submitted = await db.application.count({
      where: { id: { in: drafts.map((d) => d.id) }, status: ApplicationStatus.SUBMITTED },
    });
    assert.equal(submitted, 25, "every draft must now be SUBMITTED");

    const events = await db.applicationEvent.count({
      where: { applicationId: { in: drafts.map((d) => d.id) }, action: "submitted" },
    });
    assert.equal(events, 25, "every submission must be recorded in the history");
  });

  it("does not burn a number when there is nothing left to submit", async () => {
    const draft = await createDraft(academicYearId);
    draftIds.push(draft.id);

    const first = await finaliseSubmission({
      applicationId: draft.id,
      year: TEST_YEAR,
      accessTokenHash: `test-${draft.id}-a`,
      contactEmail: null,
      contactPhone: null,
    });
    assert.ok(first, "a draft must be submittable once");

    const before = await db.applicationCounter.findUniqueOrThrow({ where: { year: TEST_YEAR } });

    // A double submit — the same draft again — must be refused without
    // touching the counter: the number would otherwise be lost for ever.
    const second = await finaliseSubmission({
      applicationId: draft.id,
      year: TEST_YEAR,
      accessTokenHash: `test-${draft.id}-b`,
      contactEmail: null,
      contactPhone: null,
    });
    assert.equal(second, null, "an already-submitted application must be refused");

    // So must an application that does not exist at all.
    const ghost = await finaliseSubmission({
      applicationId: "no-such-application",
      year: TEST_YEAR,
      accessTokenHash: "test-ghost",
      contactEmail: null,
      contactPhone: null,
    });
    assert.equal(ghost, null);

    const after = await db.applicationCounter.findUniqueOrThrow({ where: { year: TEST_YEAR } });
    assert.equal(after.lastNumber, before.lastNumber, "a refused submission must not burn a number");

    const stored = await db.application.findUniqueOrThrow({
      where: { id: draft.id },
      select: { referenceNumber: true, accessTokenHash: true },
    });
    assert.equal(stored.referenceNumber, first, "the first submission's reference must stand");
    assert.equal(stored.accessTokenHash, `test-${draft.id}-a`, "the second attempt must not overwrite the portal token");
  });
});

describe("drafts", () => {
  it("round-trips through the resume token and hides the token's hash", async () => {
    const { id, token } = await createDraft(academicYearId);
    draftIds.push(id);

    const found = await findDraft(token);
    assert.equal(found?.id, id);
    assert.equal(found?.status, ApplicationStatus.DRAFT);
    assert.equal(found?.currentStep, ApplicationStep.APPLICANT);

    const row = await db.application.findUnique({
      where: { id },
      select: { draftTokenHash: true },
    });
    assert.notEqual(row?.draftTokenHash, token, "the raw token must never be stored");

    assert.equal(await findDraft(`${token}x`), null);
    assert.equal(await findDraft(""), null);
  });

  it("is no longer a draft once submitted", async () => {
    const { id, token } = await createDraft(academicYearId);
    draftIds.push(id);

    await db.application.update({
      where: { id },
      data: { status: ApplicationStatus.SUBMITTED },
    });
    assert.equal(await findDraft(token), null);
  });
});

const config: ApplicationConfig = {
  classes: [
    { id: "s1", name: "Senior 1", level: StudyLevel.O_LEVEL },
    { id: "s5", name: "Senior 5", level: StudyLevel.A_LEVEL },
  ],
  documentTypes: [
    {
      id: "photo",
      name: "Passport photograph",
      description: null,
      level: StudyLevel.BOTH,
      isRequired: true,
      acceptedMimeTypes: ["image/jpeg"],
      maxSizeBytes: 1024,
    },
    {
      id: "uce",
      name: "UCE result slip",
      description: null,
      level: StudyLevel.A_LEVEL,
      isRequired: true,
      acceptedMimeTypes: ["application/pdf"],
      maxSizeBytes: 1024,
    },
  ],
  fields: [],
};

function draft(overrides: Partial<DraftApplication> = {}): DraftApplication {
  return {
    id: "app",
    status: ApplicationStatus.DRAFT,
    currentStep: ApplicationStep.REVIEW,
    academicYearId: "year",
    applicationClassId: "s1",
    boardingPreference: "BOARDING",
    firstName: "Amina",
    middleName: null,
    lastName: "Nakato",
    dateOfBirth: new Date("2012-04-15T00:00:00.000Z"),
    gender: "FEMALE",
    nationality: "Ugandan",
    homeDistrict: null,
    homeAddress: null,
    guardianName: "Grace Nakato",
    guardianRelationship: "Mother",
    guardianPhone: "+256 700 000 001",
    guardianAltPhone: null,
    guardianEmail: null,
    guardianAddress: null,
    guardianOccupation: null,
    previousSchool: "Bugema Primary",
    previousClass: "P7",
    yearCompleted: 2025,
    examIndexNumber: null,
    examResults: null,
    answers: {},
    contactEmail: null,
    contactPhone: null,
    lastSavedAt: new Date(),
    academicYear: { id: "year", name: "2027" },
    applicationClass: { id: "s1", name: "Senior 1", level: StudyLevel.O_LEVEL },
    documents: [],
    ...overrides,
  };
}

const photo: DraftApplication["documents"][number] = {
  id: "doc1",
  documentTypeId: "photo",
  status: "PENDING",
  note: null,
  createdAt: new Date(),
  mediaAsset: { id: "m1", originalName: "photo.jpg", size: 10, mimeType: "image/jpeg", storageKey: "k" },
};

describe("steps", () => {
  it("shows the documents step only when the level has document types", () => {
    const oLevel = visibleSteps(config, { applicationClass: { level: StudyLevel.O_LEVEL } });
    assert.ok(oLevel.some((step) => step.step === ApplicationStep.DOCUMENTS));
    assert.ok(!oLevel.some((step) => step.step === ApplicationStep.ADDITIONAL), "no extra questions configured");

    const none = visibleSteps({ ...config, documentTypes: [] }, { applicationClass: null });
    assert.ok(!none.some((step) => step.step === ApplicationStep.DOCUMENTS));
  });

  it("walks back to a visible step when the recorded one has disappeared", () => {
    const steps = visibleSteps(config, { applicationClass: null });
    // ADDITIONAL is not shown; an applicant recorded there lands on ACADEMIC.
    assert.equal(furthestStep(steps, ApplicationStep.ADDITIONAL).step, ApplicationStep.ACADEMIC);
    assert.equal(stepAfter(steps, ApplicationStep.ACADEMIC)?.step, ApplicationStep.DOCUMENTS);
    assert.equal(stepAfter(steps, ApplicationStep.REVIEW), null);
  });
});

describe("applicant uploads after submission", () => {
  const pending = { status: "PENDING" as const };
  const replace = { status: "REPLACEMENT_REQUIRED" as const };

  it("allows filling a gap or answering a request while the application is open", () => {
    for (const status of [
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.DOCUMENTS_REQUIRED,
      ApplicationStatus.SHORTLISTED,
      ApplicationStatus.CONDITIONALLY_ACCEPTED,
    ]) {
      assert.equal(canApplicantUpload({ status }, null), true, `${status}: missing document`);
      assert.equal(canApplicantUpload({ status }, replace), true, `${status}: replacement`);
      assert.equal(canApplicantUpload({ status }, pending), false, `${status}: already under review`);
    }
  });

  it("closes uploads once the application is decided, withdrawn or still a draft", () => {
    for (const status of [
      ApplicationStatus.ACCEPTED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
      ApplicationStatus.DRAFT,
    ]) {
      assert.equal(canApplicantUpload({ status }, null), false, status);
      assert.equal(canApplicantUpload({ status }, replace), false, status);
    }
  });
});

describe("validation before submission", () => {
  it("accepts a complete application", () => {
    assert.equal(validateForSubmission(draft({ documents: [photo] }), config), null);
  });

  it("points at the step with the missing answer", () => {
    assert.equal(
      validateForSubmission(draft({ documents: [photo], guardianPhone: null }), config)?.step,
      ApplicationStep.GUARDIAN,
    );
    assert.equal(
      validateForSubmission(draft({ documents: [photo], firstName: "" }), config)?.step,
      ApplicationStep.APPLICANT,
    );
  });

  it("requires only the documents that apply to the chosen level", () => {
    const oLevel = validateForSubmission(draft({ documents: [photo] }), config);
    assert.equal(oLevel, null, "O-level does not need the UCE slip");

    const aLevel = validateForSubmission(
      draft({
        documents: [photo],
        applicationClassId: "s5",
        applicationClass: { id: "s5", name: "Senior 5", level: StudyLevel.A_LEVEL },
      }),
      config,
    );
    assert.equal(aLevel?.step, ApplicationStep.DOCUMENTS);
    assert.match(aLevel?.message ?? "", /UCE result slip/);
  });

  it("rejects a class that is no longer offered", () => {
    const problem = validateForSubmission(
      draft({ documents: [photo], applicationClassId: "retired" }),
      config,
    );
    assert.equal(problem?.step, ApplicationStep.APPLICANT);
  });

  it("enforces a required question added after the step was saved", () => {
    const withQuestion: ApplicationConfig = {
      ...config,
      fields: [
        {
          id: "f",
          key: "transport",
          label: "Transport",
          helpText: null,
          fieldType: "SELECT",
          options: [{ value: "bus", label: "Bus" }],
          isRequired: true,
          step: ApplicationStep.ADDITIONAL,
        },
      ],
    };
    assert.equal(
      validateForSubmission(draft({ documents: [photo] }), withQuestion)?.step,
      ApplicationStep.ADDITIONAL,
    );
    assert.equal(
      validateForSubmission(draft({ documents: [photo], answers: { transport: "bus" } }), withQuestion),
      null,
    );
  });
});
