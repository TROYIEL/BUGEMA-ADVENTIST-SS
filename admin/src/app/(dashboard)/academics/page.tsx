import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/dal";
import { ContentStatus } from "@/generated/prisma/enums";
import { listDepartments, listPrograms, listStaffChoices, listSubjects, LEVEL_WORDS } from "@/lib/school-admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { ConfigRow, ConfigSection, DeleteControl, MoveControls } from "@/components/config/layout";
import { SubjectForm } from "@/components/school/forms";
import { OrderedList } from "@/components/school/ordered-list";

import { deleteSubjectAction, moveAcademicAction, saveSubjectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Academics" };

/**
 * What the school teaches: programmes and departments (each with its own
 * page on the website) and the subject list, all in the order shown.
 */
export default async function AcademicsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requirePagePermission("academics:write");
  const [{ deleted }, programs, departments, subjects, staff] = await Promise.all([
    searchParams,
    listPrograms(),
    listDepartments(),
    listSubjects(),
    listStaffChoices(),
  ]);
  const departmentChoices = departments.map((d) => ({ id: d.id, name: d.title }));

  return (
    <div className="container-admin max-w-5xl py-8">
      <header>
        <h1 className="text-2xl font-semibold text-navy-900">Academics</h1>
        <p className="mt-1 text-sm text-ink-600">Programmes, departments and subjects, in the order the website shows them.</p>
      </header>
      {deleted ? <Alert tone="success" className="mt-6 max-w-3xl">The {deleted} was deleted.</Alert> : null}

      <div className="mt-6 flex flex-col gap-8">
        <OrderedList
          title="Programmes"
          hint="Courses of study. Each has a page and a card on the academics page."
          rows={programs}
          basePath="/academics/programmes"
          kind="programme"
          moveAction={moveAcademicAction}
          newLabel="New programme"
        />
        <OrderedList
          title="Departments"
          hint="Each has a page listing its subjects and, if set, its head."
          rows={departments}
          basePath="/academics/departments"
          kind="department"
          moveAction={moveAcademicAction}
          newLabel="New department"
        />
        <ConfigSection
          id="subjects"
          title="Subjects"
          hint="Listed on the subjects page under the level they are taught at."
          add={
            <SubjectForm
              action={saveSubjectAction.bind(null, null)}
              values={{ name: "", description: "", departmentId: "", teacherId: "", level: "BOTH", isCore: false, status: ContentStatus.PUBLISHED }}
              departments={departmentChoices}
              staff={staff}
              submitLabel="Add subject"
            />
          }
        >
          {subjects.map((row, index) => (
            <ConfigRow
              key={row.id}
              title={row.name}
              muted={row.status !== ContentStatus.PUBLISHED}
              badges={
                <>
                  <Badge tone="navy">{LEVEL_WORDS[row.level]}</Badge>
                  {row.isCore ? <Badge tone="gold">Core</Badge> : null}
                  {row.status !== ContentStatus.PUBLISHED ? <Badge tone="neutral">Draft</Badge> : null}
                </>
              }
              meta={[row.department?.name, row.teacher ? `Lead: ${row.teacher.name}` : null, row.description].filter(Boolean).join(" · ") || undefined}
              editor={
                <SubjectForm
                  action={saveSubjectAction.bind(null, row.id)}
                  values={{
                    name: row.name,
                    description: row.description ?? "",
                    departmentId: row.departmentId ?? "",
                    teacherId: row.teacherId ?? "",
                    level: row.level,
                    isCore: row.isCore,
                    status: row.status,
                  }}
                  departments={departmentChoices}
                  staff={staff}
                  submitLabel="Save"
                />
              }
              controls={
                <>
                  <MoveControls action={moveAcademicAction} hidden={{ id: row.id, kind: "subject" }} first={index === 0} last={index === subjects.length - 1} label={row.name} />
                  <DeleteControl action={deleteSubjectAction} id={row.id} label={row.name} />
                </>
              }
            />
          ))}
        </ConfigSection>
      </div>
    </div>
  );
}
