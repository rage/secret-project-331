"use client"

import { css } from "@emotion/css"
import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseModuleCompletionNeedsReviewBadge from "@/components/CourseModuleCompletionNeedsReviewBadge"
import { ABSENT } from "@/components/credit-registration/constants"
import CreditRegistrationStatusCell from "@/components/credit-registration/CreditRegistrationStatusCell"
import type { CreditRegistrationIndex } from "@/components/credit-registration/teacherCreditRegistrations"
import { creditRegistrationKey } from "@/components/credit-registration/teacherCreditRegistrations"
import { computeLabel, UserDisplay } from "@/components/UserDisplay"
import type { CourseModule } from "@/generated/api/types.generated"

import { StudentsTable } from "../../../courses/[id]/students/StudentsTable"
import type { StudentsTableFeatures } from "../../../courses/[id]/students/studentsTableFeatures"
import { COMPLETIONS_LEAF_MIN_WIDTH } from "../../../courses/[id]/students/studentsTableStyles"
import type { CompletionsRow, ModuleCompletionSummary } from "./completionsRows"
import { moduleSummaryOf, PREREQUISITE_MARK } from "./completionsRows"

export interface CompletionsTableProps {
  courseId: string | null
  sortedCourseModules: CourseModule[]
  rows: CompletionsRow[]
  creditRegistrations: CreditRegistrationIndex
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
}

/** Avatar, gap, padding and border of the student pill, none of which text measurement can see. */
const STUDENT_PILL_CHROME_PX = 50

/** Width of the review badge and the attempt note, which the text measurement cannot see. */
const GRADE_CHROME_PX = 60

/** The sort key the page's sorter recognises for the student column. */
export const STUDENT_COLUMN_ID = "student"

// Single line, right-aligned so every row is the same height and grades read as numbers, which is
// what keeps the virtualized body from shifting as it scrolls.
const inlineCellCss = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  min-width: 0;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
`

const attemptsCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  white-space: nowrap;
`

const gradeText = (summary: ModuleCompletionSummary, t: TFunction): string => {
  if (summary.latest === null) {
    return ABSENT
  }
  const grade = summary.latest.grade
  if (grade !== null && grade !== undefined) {
    return String(grade)
  }
  return summary.latest.passed ? t("label-passed") : t("label-not-passed")
}

const GradeCell: React.FC<{ summary: ModuleCompletionSummary }> = ({ summary }) => {
  const { t } = useTranslation()
  if (summary.latest === null) {
    return <div className={inlineCellCss}>{ABSENT}</div>
  }
  return (
    <div className={inlineCellCss}>
      <span
        {...(summary.latest.prerequisite_modules_completed
          ? {}
          : {
              title: t("module-is-completed-but-requires-completion-of-prerequisite-modules"),
            })}
      >
        {gradeText(summary, t)}
        {!summary.latest.prerequisite_modules_completed && PREREQUISITE_MARK}
      </span>
      {summary.attempts > 1 && (
        <span className={attemptsCss}>
          {t("completion-attempt-count", { count: summary.attempts })}
        </span>
      )}
      {summary.latest.needs_to_be_reviewed && <CourseModuleCompletionNeedsReviewBadge />}
    </div>
  )
}

const buildColumns = (
  sortedCourseModules: CourseModule[],
  courseId: string | null,
  creditRegistrations: CreditRegistrationIndex,
  t: TFunction,
): ColumnDef<StudentsTableFeatures, CompletionsRow, unknown>[] => {
  const columns: ColumnDef<StudentsTableFeatures, CompletionsRow, unknown>[] = [
    {
      id: STUDENT_COLUMN_ID,
      header: t("label-student"),
      minSize: 80,
      cell: ({ row }) => (
        <UserDisplay
          userId={row.original.userId}
          courseId={courseId}
          prefetchedIdentity={{
            firstName: row.original.firstName,
            lastName: row.original.lastName,
            email: row.original.email,
          }}
        />
      ),
      meta: {
        measureValue: (row: CompletionsRow) =>
          computeLabel(
            { firstName: row.firstName, lastName: row.lastName, email: row.email },
            row.userId,
          ).displayText,
        measureExtraPx: STUDENT_PILL_CHROME_PX,
      },
    },
  ]

  for (const courseModule of sortedCourseModules) {
    columns.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: `${courseModule.id}__group`,
      header: courseModule.name ?? t("label-default"),
      columns: [
        {
          id: courseModule.id,
          header: t("label-grade"),
          minSize: COMPLETIONS_LEAF_MIN_WIDTH,
          cell: ({ row }) => <GradeCell summary={moduleSummaryOf(row.original, courseModule.id)} />,
          meta: {
            measureValue: (row: CompletionsRow) =>
              gradeText(moduleSummaryOf(row, courseModule.id), t),
            measureExtraPx: GRADE_CHROME_PX,
          },
        },
        {
          // oxlint-disable-next-line i18next/no-literal-string
          id: `${courseModule.id}__registration`,
          header: t("credit-registration-column-registration"),
          enableSorting: false,
          minSize: COMPLETIONS_LEAF_MIN_WIDTH,
          cell: ({ row }) => {
            const registration = creditRegistrations.get(
              creditRegistrationKey(row.original.userId, courseModule.id),
            )
            if (registration) {
              return <CreditRegistrationStatusCell registration={registration} />
            }
            const summary = moduleSummaryOf(row.original, courseModule.id)
            if (summary.latest === null) {
              return null
            }
            return <span>{summary.latest.registered ? t("yes") : ABSENT}</span>
          },
        },
      ],
    })
  }

  return columns
}

/** One row per student, newest completion per module, sorted and filtered by the page above. */
const CompletionsTable: React.FC<CompletionsTableProps> = ({
  courseId,
  sortedCourseModules,
  rows,
  creditRegistrations,
  sorting,
  onSortingChange,
}) => {
  const { t } = useTranslation()
  const columns = useMemo(
    () => buildColumns(sortedCourseModules, courseId, creditRegistrations, t),
    [sortedCourseModules, courseId, creditRegistrations, t],
  )

  return (
    <StudentsTable
      columns={columns}
      data={rows}
      sorting={sorting}
      onSortingChange={onSortingChange}
    />
  )
}

export default CompletionsTable
