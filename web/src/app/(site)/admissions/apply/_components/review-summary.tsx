import Link from "next/link";
import type { ReactNode } from "react";

import { ApplicationStep } from "@/generated/prisma/enums";
import {
  BOARDING_LABELS,
  GENDER_LABELS,
  formatAnswer,
  stepDefinition,
  type FormFieldDefinition,
  type StepDefinition,
} from "@/lib/application-schemas";
import {
  documentTypesFor,
  fieldsForStep,
  readAnswers,
  type ApplicationConfig,
  type DraftApplication,
} from "@/lib/applications";
import { formatDate } from "@/lib/content";
import { Badge } from "@/components/ui/badge";

import { formatBytes } from "./format";

/**
 * Everything the applicant is about to submit, laid out for checking, with a
 * "Change" link back to the step each part came from.
 */

function Section({
  title,
  step,
  steps,
  children,
}: {
  title: string;
  step: ApplicationStep;
  steps: StepDefinition[];
  children: ReactNode;
}) {
  const definition = stepDefinition(step);
  const visible = steps.some((entry) => entry.step === step);

  return (
    <section className="border-t border-line pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-xl text-navy-900">{title}</h3>
        {visible ? (
          <Link
            href={`/admissions/apply/${definition.slug}`}
            className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline"
          >
            Change
          </Link>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        {children}
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <>
      <dt className="text-sm font-semibold text-ink-600">{label}</dt>
      <dd className={`text-[0.9375rem] ${empty ? "text-ink-500" : "text-navy-900"}`}>
        {empty ? "Not given" : value}
      </dd>
    </>
  );
}

function AnswerRows({
  fields,
  answers,
}: {
  fields: FormFieldDefinition[];
  answers: Record<string, unknown>;
}) {
  return (
    <>
      {fields.map((field) => (
        <Row key={field.id} label={field.label} value={formatAnswer(field, answers[field.key])} />
      ))}
    </>
  );
}

export function ReviewSummary({
  application,
  config,
  steps,
}: {
  application: DraftApplication;
  config: ApplicationConfig;
  steps: StepDefinition[];
}) {
  const answers = readAnswers(application);
  const level = application.applicationClass?.level ?? null;
  const documentTypes = documentTypesFor(config, level);
  const additionalFields = fieldsForStep(config, ApplicationStep.ADDITIONAL);

  return (
    <div className="flex flex-col gap-8">
      <Section title="The applicant" step={ApplicationStep.APPLICANT} steps={steps}>
        <Row label="Applying for" value={application.applicationClass?.name} />
        <Row
          label="Day or boarding"
          value={application.boardingPreference ? BOARDING_LABELS[application.boardingPreference] : ""}
        />
        <Row
          label="Full name"
          value={[application.firstName, application.middleName, application.lastName]
            .filter(Boolean)
            .join(" ")}
        />
        <Row label="Date of birth" value={formatDate(application.dateOfBirth)} />
        <Row label="Gender" value={application.gender ? GENDER_LABELS[application.gender] : ""} />
        <Row label="Nationality" value={application.nationality} />
        <Row label="District" value={application.homeDistrict} />
        <Row label="Address" value={application.homeAddress} />
        <AnswerRows fields={fieldsForStep(config, ApplicationStep.APPLICANT)} answers={answers} />
      </Section>

      <Section title="Parent or guardian" step={ApplicationStep.GUARDIAN} steps={steps}>
        <Row label="Name" value={application.guardianName} />
        <Row label="Relationship" value={application.guardianRelationship} />
        <Row label="Occupation" value={application.guardianOccupation} />
        <Row label="Telephone" value={application.guardianPhone} />
        <Row label="Another telephone" value={application.guardianAltPhone} />
        <Row label="Email" value={application.guardianEmail} />
        <Row label="Address" value={application.guardianAddress} />
        <AnswerRows fields={fieldsForStep(config, ApplicationStep.GUARDIAN)} answers={answers} />
      </Section>

      <Section title="Schooling so far" step={ApplicationStep.ACADEMIC} steps={steps}>
        <Row label="School" value={application.previousSchool} />
        <Row label="Class" value={application.previousClass} />
        <Row label="Year completed" value={application.yearCompleted ?? ""} />
        <Row label="Examination index number" value={application.examIndexNumber} />
        <Row
          label="Results"
          value={
            application.examResults ? (
              <span className="whitespace-pre-line">{application.examResults}</span>
            ) : (
              ""
            )
          }
        />
        <AnswerRows fields={fieldsForStep(config, ApplicationStep.ACADEMIC)} answers={answers} />
      </Section>

      {additionalFields.length > 0 ? (
        <Section title="A few more questions" step={ApplicationStep.ADDITIONAL} steps={steps}>
          <AnswerRows fields={additionalFields} answers={answers} />
        </Section>
      ) : null}

      {documentTypes.length > 0 ? (
        <Section title="Documents" step={ApplicationStep.DOCUMENTS} steps={steps}>
          {documentTypes.map((type) => {
            const document = application.documents.find((doc) => doc.documentTypeId === type.id);
            return (
              <Row
                key={type.id}
                label={type.name}
                value={
                  document ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{document.mediaAsset.originalName}</span>
                      <span className="text-sm text-ink-500">
                        {formatBytes(document.mediaAsset.size)}
                      </span>
                    </span>
                  ) : type.isRequired ? (
                    <Badge tone="warning">Missing — required</Badge>
                  ) : (
                    ""
                  )
                }
              />
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}
