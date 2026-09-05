"use client"

import { cx } from "@emotion/css"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import React, { useDeferredValue, useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseModuleCompletionNeedsReviewBadge from "@/components/CourseModuleCompletionNeedsReviewBadge"
import { ABSENT, QUIET_REFRESH } from "@/components/credit-registration/constants"
import CourseCreditRegistrationSummaryPanel, {
  CreditRegistrationSummaryLine,
} from "@/components/credit-registration/CourseCreditRegistrationSummaryPanel"
import CreditRegistrationStatusCell, {
  CREDIT_REGISTRATION_CELL_CHROME_PX,
  creditRegistrationCellText,
} from "@/components/credit-registration/CreditRegistrationStatusCell"
import { sectionsCss } from "@/components/credit-registration/styles"
import type { CreditRegistrationIndex } from "@/components/credit-registration/teacherCreditRegistrations"
import {
  creditRegistrationKey,
  useTeacherCreditRegistrations,
} from "@/components/credit-registration/teacherCreditRegistrations"
import type { CompletionGridRow, CourseCreditRegistration } from "@/generated/api/types.generated"
import { QueryResults } from "@/shared-module/components"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import {
  DETAIL_SORT_COLUMNS,
  formatStudentName,
  useCourseStudentsCompletionsDetail,
  useCourseStudentsIdentity,
} from "../studentsQueries"
import { StudentsTable } from "../StudentsTable"
import type { StudentsTableFeatures } from "../studentsTableFeatures"
import { COMPLETIONS_LEAF_MIN_WIDTH, inlineCellCss, numericCellCss } from "../studentsTableStyles"
import { StaleTableWrapper } from "./StaleTableWrapper"
import { STUDENT_PILL_CHROME_PX, StudentPillCell, studentPillText } from "./StudentPillCell"

type CompletionRow = Record<string, unknown> & {
  user_id: string
  student: string
  first_name?: string | null | undefined
  last_name?: string | null | undefined
  email?: string | null | undefined
}

/** One completion column group: keyed by the module's id (names are not unique), labelled by name. */
interface ModuleColumn {
  id: string
  label: string
  /** Whether this module grades numerically; a pass/fail word does not want right alignment. */
  hasNumericGrades: boolean
}

const gradeKeyOf = (moduleId: string) => `${moduleId}__grade`
const passedKeyOf = (moduleId: string) => `${moduleId}__passed`
const registeredKeyOf = (moduleId: string) => `${moduleId}__registered`
const needsReviewKeyOf = (moduleId: string) => `${moduleId}__needsReview`

/**
 * Pivots the flat (user × module) completion rows into one wide row per user. Columns are keyed by
 * `module_id` (names are not unique) so modules with identical names never collide onto the same cells.
 */
const pivotCompletions = (
  identityRows: {
    user_id: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
  }[],
  completions: CompletionGridRow[],
  t: TFunction,
) => {
  const modulesInOrder: ModuleColumn[] = []
  const seen = new Set<string>()
  const byUser = new Map<string, Record<string, unknown>>()
  const numericModuleIds = new Set<string>()
  for (const r of completions) {
    if (!seen.has(r.module_id)) {
      seen.add(r.module_id)
      modulesInOrder.push({
        id: r.module_id,
        label: r.module && r.module.trim().length > 0 ? r.module : t("default-module"),
        hasNumericGrades: false,
      })
    }
    if (typeof r.grade === "number") {
      numericModuleIds.add(r.module_id)
    }
    const existing = byUser.get(r.user_id) ?? {}
    existing[gradeKeyOf(r.module_id)] = r.grade ?? null
    existing[passedKeyOf(r.module_id)] = r.passed ?? null
    existing[registeredKeyOf(r.module_id)] = r.registered
    existing[needsReviewKeyOf(r.module_id)] = r.needs_to_be_reviewed
    byUser.set(r.user_id, existing)
  }
  for (const column of modulesInOrder) {
    column.hasNumericGrades = numericModuleIds.has(column.id)
  }
  const data: CompletionRow[] = identityRows.map((u) => ({
    user_id: u.user_id,
    student: formatStudentName(u, t),
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    ...byUser.get(u.user_id),
  }))
  return { modulesInOrder, data }
}

const gradeLabel = (grade: unknown, passed: unknown, t: TFunction): string => {
  if (typeof grade === "number") {
    return String(grade)
  }
  if (passed === true) {
    return t("label-passed")
  }
  if (passed === false) {
    return t("label-not-passed")
  }
  return ABSENT
}

/** Width of the review badge, which the plain-text column measurement cannot see. */
const NEEDS_REVIEW_BADGE_PX = 44

const GradeCell: React.FC<{
  grade: unknown
  passed: unknown
  needsReview: boolean
  isNumeric: boolean
}> = ({ grade, passed, needsReview, isNumeric }) => {
  const { t } = useTranslation()
  return (
    <div className={cx(inlineCellCss, isNumeric && numericCellCss)}>
      <span>{gradeLabel(grade, passed, t)}</span>
      {needsReview && <CourseModuleCompletionNeedsReviewBadge />}
    </div>
  )
}

/** The registry's own state when the ledger has a row, else the legacy registered flag. */
const RegistrationCell: React.FC<{
  registered: boolean
  creditRegistration: CourseCreditRegistration | undefined
}> = ({ registered, creditRegistration }) => {
  const { t } = useTranslation()
  if (creditRegistration) {
    return <CreditRegistrationStatusCell registration={creditRegistration} />
  }
  return <span>{registered ? t("registered") : ABSENT}</span>
}

const buildColumns = (
  modulesInOrder: ModuleColumn[],
  t: TFunction,
  creditRegistrations: CreditRegistrationIndex,
): ColumnDef<StudentsTableFeatures, CompletionRow, unknown>[] => {
  const columns: ColumnDef<StudentsTableFeatures, CompletionRow, unknown>[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "last_name",
      header: t("label-student"),
      minSize: 80,
      cell: ({ row }) => (
        <StudentPillCell
          userId={row.original.user_id}
          firstName={row.original.first_name}
          lastName={row.original.last_name}
          email={row.original.email}
        />
      ),
      meta: { measureValue: studentPillText, measureExtraPx: STUDENT_PILL_CHROME_PX },
    },
  ]

  modulesInOrder.forEach(({ id: moduleId, label, hasNumericGrades }) => {
    columns.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: `${moduleId}__group`,
      header: label || "",
      columns: [
        {
          id: gradeKeyOf(moduleId),
          header: t("grade"),
          accessorKey: gradeKeyOf(moduleId),
          enableSorting: false,
          minSize: COMPLETIONS_LEAF_MIN_WIDTH,
          cell: ({ row }) => (
            <GradeCell
              grade={row.original[gradeKeyOf(moduleId)]}
              passed={row.original[passedKeyOf(moduleId)]}
              needsReview={Boolean(row.original[needsReviewKeyOf(moduleId)])}
              isNumeric={hasNumericGrades}
            />
          ),
          meta: { measureExtraPx: NEEDS_REVIEW_BADGE_PX },
        },
        {
          // oxlint-disable-next-line i18next/no-literal-string
          id: `${moduleId}__registration`,
          header: t("credit-registration-column-registration"),
          enableSorting: false,
          minSize: COMPLETIONS_LEAF_MIN_WIDTH,
          cell: ({ row }) => (
            <RegistrationCell
              registered={Boolean(row.original[registeredKeyOf(moduleId)])}
              creditRegistration={creditRegistrations.get(
                creditRegistrationKey(row.original.user_id, moduleId),
              )}
            />
          ),
          meta: {
            measureValue: (row: CompletionRow) =>
              creditRegistrationCellText(
                t,
                creditRegistrations.get(creditRegistrationKey(row.user_id, moduleId)),
              ),
            measureExtraPx: CREDIT_REGISTRATION_CELL_CHROME_PX,
          },
        },
      ],
    })
  })

  return columns
}

export const CompletionsTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId, courseInstanceId, moduleId, setRegistrationView } = useStudentsContext()
  const params = useStudentsListParams(DETAIL_SORT_COLUMNS)
  const { sorting, onSortingChange } = useStudentsSorting(DETAIL_SORT_COLUMNS)

  const identityQuery = useCourseStudentsIdentity(courseId, params)
  const identityRows = useMemo(() => identityQuery.data?.data ?? [], [identityQuery.data])
  const userIds = useMemo(() => identityRows.map((r) => r.user_id), [identityRows])
  const detailQuery = useCourseStudentsCompletionsDetail(courseId, userIds)
  const { data: creditRegistrations, isAuthorized: canSeeCreditRegistrations } =
    useTeacherCreditRegistrations(courseId, userIds)

  // Deferred *after* userIds/detailQuery are derived so a search/sort/page commit still fires the
  // detail request promptly -- only the expensive pivot below is deprioritized.
  const deferredIdentityRows = useDeferredValue(identityRows)
  const deferredDetailData = useDeferredValue(detailQuery.data)
  const isStale = deferredIdentityRows !== identityRows || deferredDetailData !== detailQuery.data

  const { modulesInOrder, data } = useMemo(
    () => pivotCompletions(deferredIdentityRows, deferredDetailData ?? [], t),
    [deferredIdentityRows, deferredDetailData, t],
  )
  const columns = useMemo(
    () => buildColumns(modulesInOrder, t, creditRegistrations),
    [modulesInOrder, t, creditRegistrations],
  )

  // The detail request is skipped while the page lists nobody, so a query that can never resolve
  // must stay out of the tuple.
  const queries = userIds.length > 0 ? [identityQuery, detailQuery] : [identityQuery]

  return (
    <div className={sectionsCss}>
      {canSeeCreditRegistrations && (
        <CreditRegistrationSummaryLine
          courseId={courseId}
          courseInstanceId={courseInstanceId}
          onSelectView={setRegistrationView}
        />
      )}
      <QueryResults
        queries={queries}
        treatEmptyAsData
        refreshIndicator={QUIET_REFRESH}
        renderData={() => (
          <StaleTableWrapper isStale={isStale}>
            <StudentsTable
              columns={columns}
              data={data}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />
          </StaleTableWrapper>
        )}
      />
      {canSeeCreditRegistrations && (
        <CourseCreditRegistrationSummaryPanel
          courseId={courseId}
          courseInstanceId={courseInstanceId}
          moduleId={moduleId}
          onSelectView={setRegistrationView}
        />
      )}
    </div>
  )
}
