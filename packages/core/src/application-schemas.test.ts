import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApplicationStep, FormFieldType } from "@bass/db/enums";

import {
  academicSchema,
  applicantSchema,
  buildAnswersSchema,
  formatAnswer,
  formatReferenceNumber,
  guardianSchema,
  lookupSchema,
  normaliseReferenceNumber,
  parseFieldOptions,
  parseIsoDate,
  readAnswerFromForm,
  stepFromSlug,
  stepOrder,
  type FormFieldDefinition,
} from "./application-schemas";

const validApplicant = {
  applicationClassId: "class_1",
  boardingPreference: "BOARDING",
  firstName: "Amina",
  middleName: "",
  lastName: "Nakato",
  dateOfBirth: "2012-04-15",
  gender: "FEMALE",
  nationality: "Ugandan",
  homeDistrict: "",
  homeAddress: "",
};

describe("reference numbers", () => {
  it("formats a zero-padded reference", () => {
    assert.equal(formatReferenceNumber(2026, 123), "BASS-2026-000123");
    assert.equal(formatReferenceNumber(2026, 1), "BASS-2026-000001");
  });

  it("normalises the ways people type a reference back", () => {
    assert.equal(normaliseReferenceNumber(" bass 2026 000123 "), "BASS-2026-000123");
    assert.equal(normaliseReferenceNumber("bass–2026–000123"), "BASS-2026-000123");
    assert.equal(normaliseReferenceNumber("BASS/2026/000123"), "BASS-2026-000123");
    assert.equal(normaliseReferenceNumber("bass2026000123"), "BASS-2026-000123");
  });

  it("rejects a malformed reference in the lookup form", () => {
    const parsed = lookupSchema.safeParse({
      referenceNumber: "2026-123",
      lastName: "Nakato",
      dateOfBirth: "2012-04-15",
    });
    assert.equal(parsed.success, false);
  });
});

describe("dates", () => {
  it("parses a valid ISO date to UTC midnight", () => {
    const date = parseIsoDate("2012-04-15");
    assert.ok(date);
    assert.equal(date.toISOString(), "2012-04-15T00:00:00.000Z");
  });

  it("rejects rolled-over and malformed dates", () => {
    assert.equal(parseIsoDate("2012-02-31"), null);
    assert.equal(parseIsoDate("15/04/2012"), null);
    assert.equal(parseIsoDate(""), null);
  });
});

describe("applicant step", () => {
  it("accepts a complete applicant and normalises blanks to null", () => {
    const parsed = applicantSchema.safeParse(validApplicant);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.middleName, null);
      assert.equal(parsed.data.homeAddress, null);
      assert.ok(parsed.data.dateOfBirth instanceof Date);
    }
  });

  it("reports each missing field by name", () => {
    const parsed = applicantSchema.safeParse({
      ...validApplicant,
      firstName: "",
      gender: "",
      applicationClassId: "",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      assert.ok(fields.has("firstName"));
      assert.ok(fields.has("gender"));
      assert.ok(fields.has("applicationClassId"));
    }
  });

  it("rejects a date of birth in the future or implausibly old", () => {
    assert.equal(
      applicantSchema.safeParse({ ...validApplicant, dateOfBirth: "2099-01-01" }).success,
      false,
    );
    assert.equal(
      applicantSchema.safeParse({ ...validApplicant, dateOfBirth: "1940-01-01" }).success,
      false,
    );
  });
});

describe("guardian step", () => {
  it("requires a reachable telephone number and accepts optional email", () => {
    const ok = guardianSchema.safeParse({
      guardianName: "Grace Nakato",
      guardianRelationship: "Mother",
      guardianPhone: "+256 700 000 001",
      guardianAltPhone: "",
      guardianEmail: "",
      guardianOccupation: "",
      guardianAddress: "",
    });
    assert.equal(ok.success, true);

    const badPhone = guardianSchema.safeParse({
      guardianName: "Grace Nakato",
      guardianRelationship: "Mother",
      guardianPhone: "call me",
      guardianAltPhone: "",
      guardianEmail: "not-an-email",
      guardianOccupation: "",
      guardianAddress: "",
    });
    assert.equal(badPhone.success, false);
    if (!badPhone.success) {
      const fields = new Set(badPhone.error.issues.map((issue) => String(issue.path[0])));
      assert.ok(fields.has("guardianPhone"));
      assert.ok(fields.has("guardianEmail"));
    }
  });

  it("restricts the relationship to the offered options", () => {
    const parsed = guardianSchema.safeParse({
      guardianName: "Grace Nakato",
      guardianRelationship: "Neighbour",
      guardianPhone: "0700000001",
      guardianAltPhone: "",
      guardianEmail: "",
      guardianOccupation: "",
      guardianAddress: "",
    });
    assert.equal(parsed.success, false);
  });
});

describe("academic step", () => {
  it("turns an empty year into null and a typed year into a number", () => {
    const blank = academicSchema.safeParse({
      previousSchool: "Bugema Primary",
      previousClass: "P7",
      yearCompleted: "",
      examIndexNumber: "",
      examResults: "",
    });
    assert.equal(blank.success, true);
    if (blank.success) assert.equal(blank.data.yearCompleted, null);

    const typed = academicSchema.safeParse({
      previousSchool: "Bugema Primary",
      previousClass: "P7",
      yearCompleted: "2025",
      examIndexNumber: "",
      examResults: "",
    });
    assert.equal(typed.success, true);
    if (typed.success) assert.equal(typed.data.yearCompleted, 2025);

    assert.equal(
      academicSchema.safeParse({
        previousSchool: "Bugema Primary",
        previousClass: "P7",
        yearCompleted: "25",
        examIndexNumber: "",
        examResults: "",
      }).success,
      false,
    );
  });
});

describe("steps", () => {
  it("maps slugs to steps and keeps the canonical order", () => {
    assert.equal(stepFromSlug("applicant")?.step, ApplicationStep.APPLICANT);
    assert.equal(stepFromSlug("nope"), null);
    assert.ok(stepOrder(ApplicationStep.APPLICANT) < stepOrder(ApplicationStep.REVIEW));
    assert.ok(stepOrder(ApplicationStep.DOCUMENTS) < stepOrder(ApplicationStep.REVIEW));
  });
});

describe("admin-configured questions", () => {
  const field = (overrides: Partial<FormFieldDefinition>): FormFieldDefinition => ({
    id: "f1",
    key: "church",
    label: "Church attended",
    helpText: null,
    fieldType: FormFieldType.TEXT,
    options: [],
    isRequired: false,
    step: ApplicationStep.ADDITIONAL,
    ...overrides,
  });

  it("accepts options as strings or as value/label objects, ignoring junk", () => {
    assert.deepEqual(parseFieldOptions(["Yes", " No ", "", 42, null]), [
      { value: "Yes", label: "Yes" },
      { value: "No", label: "No" },
    ]);
    assert.deepEqual(parseFieldOptions([{ value: "sda", label: "Seventh-day Adventist" }]), [
      { value: "sda", label: "Seventh-day Adventist" },
    ]);
    assert.deepEqual(parseFieldOptions("not an array"), []);
  });

  it("requires an answer only when the field is required", () => {
    const optional = buildAnswersSchema([field({})]);
    assert.equal(optional.safeParse({ church: "" }).success, true);

    const required = buildAnswersSchema([field({ isRequired: true })]);
    assert.equal(required.safeParse({ church: "" }).success, false);
    assert.equal(required.safeParse({ church: "Bugema SDA" }).success, true);
  });

  it("validates choices against the configured options", () => {
    const select = field({
      key: "transport",
      fieldType: FormFieldType.SELECT,
      isRequired: true,
      options: parseFieldOptions(["Bus", "Private"]),
    });
    const schema = buildAnswersSchema([select]);
    assert.equal(schema.safeParse({ transport: "Bus" }).success, true);
    assert.equal(schema.safeParse({ transport: "Bicycle" }).success, false);

    const multi = field({
      key: "clubs",
      fieldType: FormFieldType.MULTISELECT,
      options: parseFieldOptions(["Choir", "Debate"]),
    });
    const multiSchema = buildAnswersSchema([multi]);
    assert.equal(multiSchema.safeParse({ clubs: ["Choir"] }).success, true);
    assert.equal(multiSchema.safeParse({ clubs: ["Football"] }).success, false);
  });

  it("coerces numbers, dates and checkboxes", () => {
    const schema = buildAnswersSchema([
      field({ key: "siblings", fieldType: FormFieldType.NUMBER }),
      field({ key: "baptised", fieldType: FormFieldType.DATE }),
      field({ key: "consent", fieldType: FormFieldType.CHECKBOX, isRequired: true }),
    ]);

    const ok = schema.safeParse({ siblings: "2", baptised: "2020-06-01", consent: true });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.siblings, 2);
      assert.equal(ok.data.baptised, "2020-06-01");
      assert.equal(ok.data.consent, true);
    }

    const bad = schema.safeParse({ siblings: "two", baptised: "June", consent: false });
    assert.equal(bad.success, false);
    if (!bad.success) {
      const fields = new Set(bad.error.issues.map((issue) => String(issue.path[0])));
      assert.deepEqual([...fields].sort(), ["baptised", "consent", "siblings"]);
    }
  });

  it("reads each field type out of posted form data in the shape its schema expects", () => {
    const formData = new FormData();
    formData.append("answer:clubs", "Choir");
    formData.append("answer:clubs", "Debate");
    formData.append("answer:consent", "on");
    formData.append("answer:church", "Bugema SDA");

    assert.deepEqual(
      readAnswerFromForm(formData, field({ key: "clubs", fieldType: FormFieldType.MULTISELECT })),
      ["Choir", "Debate"],
    );
    assert.equal(
      readAnswerFromForm(formData, field({ key: "consent", fieldType: FormFieldType.CHECKBOX })),
      true,
    );
    assert.equal(
      readAnswerFromForm(formData, field({ key: "missing", fieldType: FormFieldType.CHECKBOX })),
      false,
    );
    assert.equal(readAnswerFromForm(formData, field({})), "Bugema SDA");
    assert.equal(readAnswerFromForm(formData, field({ key: "absent" })), "");
  });

  it("formats stored answers with their option labels", () => {
    const select = field({
      key: "transport",
      fieldType: FormFieldType.SELECT,
      options: [{ value: "bus", label: "School bus" }],
    });
    assert.equal(formatAnswer(select, "bus"), "School bus");
    assert.equal(formatAnswer(select, "walk"), "walk");
    assert.equal(formatAnswer(field({ fieldType: FormFieldType.CHECKBOX }), true), "Yes");
    assert.equal(formatAnswer(field({ fieldType: FormFieldType.MULTISELECT }), ["a", "b"]), "a, b");
    assert.equal(formatAnswer(field({}), null), "");
  });
});
