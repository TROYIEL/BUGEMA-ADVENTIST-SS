import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { ContentStatus } from "@/generated/prisma/enums";
import {
  FIELD_TYPE_LABELS,
  STEP_LABELS,
  formatOptionsText,
  listClasses,
  listDocumentTypes,
  listFormFields,
  listRequirements,
} from "@/lib/admissions-config";
import { LEVEL_LABELS } from "@/lib/application-schemas";
import { Badge } from "@/components/ui/badge";

import { ClassForm, DocumentTypeForm, FormFieldForm, RequirementForm } from "@/components/config/forms";
import { ConfigRow, ConfigSection, DeleteControl, MoveControls } from "@/components/config/layout";

import {
  deleteClassAction,
  deleteDocumentTypeAction,
  deleteFormFieldAction,
  deleteRequirementAction,
  moveAction,
  saveClassAction,
  saveDocumentTypeAction,
  saveFormFieldAction,
  saveRequirementAction,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admissions requirements" };

const SECTIONS = [
  { id: "classes", label: "Classes" },
  { id: "documents", label: "Documents" },
  { id: "requirements", label: "Entry requirements" },
  { id: "questions", label: "Extra questions" },
];

/**
 * Everything the application form asks for, in the order the applicant meets
 * it. Changes are live: the next applicant to load a step sees them.
 */
export default async function RequirementsPage() {
  await requirePagePermission("admissions:configure");
  const [classes, documentTypes, requirements, fields] = await Promise.all([
    listClasses(),
    listDocumentTypes(),
    listRequirements(),
    listFormFields(),
  ]);

  const requiredDocs = documentTypes.filter((type) => type.isActive && type.isRequired).length;

  return (
    <div className="container-admin max-w-5xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Admissions requirements</h1>
        <p className="mt-1 text-sm text-ink-600">
          What the online application asks for. Changes take effect at once; an
          application already in progress meets them on its next step.
        </p>
        <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-navy-800 ring-1 ring-inset ring-line-strong hover:bg-navy-50"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mt-6 flex flex-col gap-8">
        {/* ---- Classes ------------------------------------------------- */}
        <ConfigSection
          id="classes"
          title="Classes"
          hint="The classes an applicant can apply to join. Switch one off rather than deleting it once applications refer to it."
          add={<ClassForm action={saveClassAction.bind(null, null)} values={{ name: "", level: "", isActive: true }} submitLabel="Add class" />}
        >
          {classes.map((row, index) => (
            <ConfigRow
              key={row.id}
              title={row.name}
              muted={!row.isActive}
              badges={
                <>
                  <Badge tone="navy">{LEVEL_LABELS[row.level]}</Badge>
                  {!row.isActive ? <Badge tone="neutral">Off</Badge> : null}
                </>
              }
              meta={`${row._count.applications} ${row._count.applications === 1 ? "application" : "applications"}`}
              editor={
                <ClassForm
                  action={saveClassAction.bind(null, row.id)}
                  values={{ name: row.name, level: row.level, isActive: row.isActive }}
                  submitLabel="Save"
                />
              }
              controls={
                <>
                  <MoveControls action={moveAction} hidden={{ id: row.id, kind: "class" }} first={index === 0} last={index === classes.length - 1} label={row.name} />
                  <DeleteControl
                    action={deleteClassAction}
                    id={row.id}
                    label={row.name}
                    disabledReason={row._count.applications > 0 ? "Applications refer to this class; switch it off instead." : null}
                  />
                </>
              }
            />
          ))}
        </ConfigSection>

        {/* ---- Document types ------------------------------------------ */}
        <ConfigSection
          id="documents"
          title="Documents"
          hint={`What applicants upload. ${requiredDocs === 0 ? "Nothing is required yet, so an application can be submitted without any document." : `${requiredDocs} required.`}`}
          add={
            <DocumentTypeForm
              action={saveDocumentTypeAction.bind(null, null)}
              values={{ name: "", description: "", level: "", isRequired: false, acceptedMimeTypes: ["image/jpeg", "image/png", "application/pdf"], maxSizeMb: "5", isActive: true }}
              submitLabel="Add document"
            />
          }
        >
          {documentTypes.map((row, index) => (
            <ConfigRow
              key={row.id}
              title={row.name}
              muted={!row.isActive}
              badges={
                <>
                  {row.isRequired ? <Badge tone="gold">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
                  {row.level !== "BOTH" ? <Badge tone="navy">{LEVEL_LABELS[row.level]}</Badge> : null}
                  {!row.isActive ? <Badge tone="neutral">Off</Badge> : null}
                </>
              }
              meta={`${row.acceptedMimeTypes.map((type) => type.split("/")[1]?.toUpperCase().replace("JPEG", "JPG")).join(", ")} · up to ${(row.maxSizeBytes / (1024 * 1024)).toFixed(0)} MB · ${row._count.documents} uploaded`}
              editor={
                <DocumentTypeForm
                  action={saveDocumentTypeAction.bind(null, row.id)}
                  values={{
                    name: row.name,
                    description: row.description ?? "",
                    level: row.level,
                    isRequired: row.isRequired,
                    acceptedMimeTypes: row.acceptedMimeTypes,
                    maxSizeMb: String(Math.round(row.maxSizeBytes / (1024 * 1024))),
                    isActive: row.isActive,
                  }}
                  submitLabel="Save"
                />
              }
              controls={
                <>
                  <MoveControls action={moveAction} hidden={{ id: row.id, kind: "documentType" }} first={index === 0} last={index === documentTypes.length - 1} label={row.name} />
                  <DeleteControl
                    action={deleteDocumentTypeAction}
                    id={row.id}
                    label={row.name}
                    disabledReason={row._count.documents > 0 ? "Uploaded documents are filed under this type; switch it off instead." : null}
                  />
                </>
              }
            />
          ))}
        </ConfigSection>

        {/* ---- Entry requirements -------------------------------------- */}
        <ConfigSection
          id="requirements"
          title="Entry requirements"
          hint="Published on the website's admissions and requirements pages. Drafts are kept but not shown."
          add={<RequirementForm action={saveRequirementAction.bind(null, null)} values={{ title: "", description: "", level: "", status: ContentStatus.PUBLISHED }} submitLabel="Add requirement" />}
        >
          {requirements.map((row, index) => (
            <ConfigRow
              key={row.id}
              title={row.title}
              muted={row.status !== ContentStatus.PUBLISHED}
              badges={
                <>
                  {row.status === ContentStatus.PUBLISHED ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
                  {row.level !== "BOTH" ? <Badge tone="navy">{LEVEL_LABELS[row.level]}</Badge> : null}
                </>
              }
              meta={row.description ?? undefined}
              editor={
                <RequirementForm
                  action={saveRequirementAction.bind(null, row.id)}
                  values={{ title: row.title, description: row.description ?? "", level: row.level, status: row.status }}
                  submitLabel="Save"
                />
              }
              controls={
                <>
                  <MoveControls action={moveAction} hidden={{ id: row.id, kind: "requirement" }} first={index === 0} last={index === requirements.length - 1} label={row.title} />
                  <DeleteControl action={deleteRequirementAction} id={row.id} label={row.title} />
                </>
              }
            />
          ))}
        </ConfigSection>

        {/* ---- Extra questions ----------------------------------------- */}
        <ConfigSection
          id="questions"
          title="Extra questions"
          hint="Questions of the school's own, added to the form. Answers are kept with each application under the question's key."
          add={
            <FormFieldForm
              action={saveFormFieldAction.bind(null, null)}
              values={{ step: "", key: "", label: "", helpText: "", fieldType: "", optionsText: "", isRequired: false, isActive: true }}
              submitLabel="Add question"
              isNew
            />
          }
        >
          {fields.map((row, index) => (
            <ConfigRow
              key={row.id}
              title={row.label}
              muted={!row.isActive}
              badges={
                <>
                  <Badge tone="navy">{FIELD_TYPE_LABELS[row.fieldType]}</Badge>
                  {row.isRequired ? <Badge tone="gold">Required</Badge> : null}
                  {!row.isActive ? <Badge tone="neutral">Off</Badge> : null}
                </>
              }
              meta={`${STEP_LABELS[row.step]} · key ${row.key}${row.options.length ? ` · ${row.options.length} options` : ""}`}
              editor={
                <FormFieldForm
                  action={saveFormFieldAction.bind(null, row.id)}
                  values={{
                    step: row.step,
                    key: row.key,
                    label: row.label,
                    helpText: row.helpText ?? "",
                    fieldType: row.fieldType,
                    optionsText: formatOptionsText(row.options),
                    isRequired: row.isRequired,
                    isActive: row.isActive,
                  }}
                  submitLabel="Save"
                  isNew={false}
                />
              }
              controls={
                <>
                  <MoveControls action={moveAction} hidden={{ id: row.id, kind: "field" }} first={index === 0} last={index === fields.length - 1} label={row.label} />
                  <DeleteControl action={deleteFormFieldAction} id={row.id} label={row.label} />
                </>
              }
            />
          ))}
        </ConfigSection>
      </div>
    </div>
  );
}
