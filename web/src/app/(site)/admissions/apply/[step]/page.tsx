import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/site/page-header";
import { Alert } from "@bass/ui/alert";
import { ButtonLink } from "@bass/ui/button";
import { getDraftToken } from "@bass/auth/applicant";
import { ApplicationStep } from "@bass/db/enums";
import { stepFromSlug, stepOrder } from "@bass/core/application-schemas";
import {
  academicValues,
  answersToFormValues,
  applicantValues,
  documentTypesFor,
  fieldsForStep,
  findDraft,
  furthestStep,
  getAdmissionsWindow,
  getApplicationConfig,
  guardianValues,
  readAnswers,
  stepBefore,
  visibleSteps,
  type DraftApplication,
} from "@bass/core/applications";

import {
  completeDocuments,
  emailResumeLink,
  removeDocument,
  saveStep,
  submit,
  uploadDocument,
} from "../actions";
import { AcademicForm } from "../_components/academic-form";
import { AdditionalForm } from "../_components/additional-form";
import { ApplicantForm } from "../_components/applicant-form";
import { DocumentsPanel } from "../_components/documents-panel";
import type { FormValues } from "../_components/form-parts";
import { GuardianForm } from "../_components/guardian-form";
import { ResumeLinkForm } from "../_components/resume-link-form";
import { ReviewSummary } from "../_components/review-summary";
import { Stepper } from "../_components/stepper";
import { SubmitForm } from "../_components/submit-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply for admission",
  // Half-finished forms are for their owners, not search engines.
  robots: { index: false, follow: false },
};

/**
 * One step of the application wizard.
 *
 * The draft comes from the visitor's cookie, never from the URL, so there is
 * nothing here to enumerate. A step further along than the applicant has
 * reached sends them back to where they were; an earlier one is always
 * allowed, so an answer can be changed.
 */
export default async function StepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  const definition = stepFromSlug(slug);
  if (!definition) notFound();

  const [window, config, token] = await Promise.all([
    getAdmissionsWindow(),
    getApplicationConfig(),
    getDraftToken(),
  ]);

  const draft = token ? await findDraft(token) : null;
  if (!draft) redirect("/admissions/apply");

  const steps = visibleSteps(config, draft);
  const furthest = furthestStep(steps, draft.currentStep);

  const shown = steps.some((entry) => entry.step === definition.step);
  if (!shown || stepOrder(definition.step) > stepOrder(furthest.step)) {
    redirect(`/admissions/apply/${furthest.slug}`);
  }

  const index = steps.findIndex((entry) => entry.step === definition.step);
  const previous = stepBefore(steps, definition.step);
  const backHref = previous ? `/admissions/apply/${previous.slug}` : "/admissions/apply";

  return (
    <main id="main" className="flex flex-1 flex-col">
      <PageHeader
        title="Apply for admission"
        eyebrow={`Applications for ${draft.academicYear.name}`}
        crumbs={[
          { label: "Admissions", href: "/admissions" },
          { label: "Apply", href: "/admissions/apply" },
          { label: definition.title },
        ]}
        size="compact"
      />

      <div className="container-page py-10 md:py-14">
        {!window.isOpen ? (
          <div className="max-w-2xl">
            <Alert tone="info" title="Applications have closed">
              Online applications are not being accepted at the moment. The
              answers you have given so far have been kept, and this page will
              work again when applications reopen.
            </Alert>
            <div className="mt-6">
              <ButtonLink href="/contact" variant="secondary">
                Contact the school
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
            <aside className="flex flex-col gap-8 lg:sticky lg:top-32 lg:self-start">
              <Stepper steps={steps} current={definition.step} furthest={furthest.step} />

              <div className="border-t border-line pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Your progress
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  Each step is saved when you continue. Come back on this
                  device and you will pick up where you left off.
                </p>
                <div className="mt-4">
                  {draft.guardianEmail ? (
                    <ResumeLinkForm action={emailResumeLink} email={draft.guardianEmail} />
                  ) : (
                    <p className="text-sm leading-relaxed text-ink-500">
                      Add an email address on the parent or guardian step and we
                      can send you a link to continue on another device.
                    </p>
                  )}
                </div>
              </div>
            </aside>

            <section className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-navy-600">
                Step {index + 1} of {steps.length}
              </p>
              <h2 className="mt-2 font-serif text-display-sm text-navy-900">{definition.title}</h2>
              <p className="mt-2 text-lg leading-relaxed text-ink-600">{definition.description}</p>

              <div className="mt-10">
                <StepContent
                  step={definition.step}
                  draft={draft}
                  config={config}
                  steps={steps}
                  backHref={backHref}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function StepContent({
  step,
  draft,
  config,
  steps,
  backHref,
}: {
  step: ApplicationStep;
  draft: DraftApplication;
  config: Awaited<ReturnType<typeof getApplicationConfig>>;
  steps: ReturnType<typeof visibleSteps>;
  backHref: string;
}) {
  const fields = fieldsForStep(config, step);
  const answers = readAnswers(draft);

  // Stored answers are keyed by field key; inputs are named `answer:<key>`.
  const answerValues: FormValues = {};
  for (const [key, value] of Object.entries(answersToFormValues(fields, answers))) {
    answerValues[`answer:${key}`] = value as string | string[] | boolean;
  }

  switch (step) {
    case ApplicationStep.APPLICANT:
      return (
        <ApplicantForm
          action={saveStep.bind(null, ApplicationStep.APPLICANT)}
          saved={{ ...applicantValues(draft), ...answerValues }}
          classes={config.classes}
          fields={fields}
        />
      );

    case ApplicationStep.GUARDIAN:
      return (
        <GuardianForm
          action={saveStep.bind(null, ApplicationStep.GUARDIAN)}
          saved={{ ...guardianValues(draft), ...answerValues }}
          fields={fields}
          backHref={backHref}
        />
      );

    case ApplicationStep.ACADEMIC:
      return (
        <AcademicForm
          action={saveStep.bind(null, ApplicationStep.ACADEMIC)}
          saved={{ ...academicValues(draft), ...answerValues }}
          fields={fields}
          backHref={backHref}
        />
      );

    case ApplicationStep.ADDITIONAL:
      return (
        <AdditionalForm
          action={saveStep.bind(null, ApplicationStep.ADDITIONAL)}
          saved={answerValues}
          fields={fields}
          backHref={backHref}
        />
      );

    case ApplicationStep.DOCUMENTS:
      return (
        <DocumentsPanel
          types={documentTypesFor(config, draft.applicationClass?.level ?? null)}
          documents={draft.documents}
          uploadAction={uploadDocument}
          removeAction={removeDocument}
          completeAction={completeDocuments}
          backHref={backHref}
        />
      );

    case ApplicationStep.REVIEW:
      return (
        <div className="flex flex-col gap-10">
          <ReviewSummary application={draft} config={config} steps={steps} />
          <SubmitForm action={submit} backHref={backHref} />
        </div>
      );

    default:
      return null;
  }
}
