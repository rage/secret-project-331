"use client"

import { cx } from "@emotion/css"
import type { ColumnDef } from "@tanstack/react-table"
import React, { useDeferredValue, useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseModuleCompletionNeedsReviewBadge from "@/components/CourseModuleCompletionNeedsReviewBadge"
import {
  ABSENT,
  CREDIT_REGISTRATION_NS,
  QUIET_REFRESH,
} from "@/components/credit-registration/constants"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import CourseCreditRegistrationSummaryPanel from "@/components/credit-registration/CourseCreditRegistrationSummaryPanel"
import CreditRegistrationSetupNote from "@/components/credit-registration/CreditRegistrationSetupNote"
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
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Spinner from "@/shared-module/common/components/Spinner"
import { EmptyState, QueryResults } from "@/shared-module/components"

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
import CompletionsActions from "./CompletionsActions"
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

interface StructureModule {
  id: string
  name?: string | null
  order_number: number
}

/**
 * Pivots the flat (user × module) completion rows into one wide row per user. Columns are keyed by
 * `module_id` (names are not unique) so modules with identical names never collide onto the same cells.
 *
 * Column presence comes from the course structure, not from `completions`: a module with zero
 * completions still gets its column, so the table's shape does not depend on who has finished it.
 * Any module a completion row names but the structure no longer has (renamed or removed since) is
 * appended after, so no historical data silently disappears.
 */
const pivotCompletions = (
  identityRows: {
    user_id: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
  }[],
  completions: CompletionGridRow[],
  structureModules: StructureModule[],
  t: CreditRegistrationTFunction,
) => {
  const numericModuleIds = new Set(
    completions.filter((r) => typeof r.grade === "number").map((r) => r.module_id),
  )
  const seen = new Set<string>()
  const modulesInOrder: ModuleColumn[] = structureModules
    .toSorted((a, b) => a.order_number - b.order_number)
    .map((module) => {
      seen.add(module.id)
      return {
        id: module.id,
        label: module.name && module.name.trim().length > 0 ? module.name : t("default-module"),
        hasNumericGrades: numericModuleIds.has(module.id),
      }
    })
  const byUser = new Map<string, Record<string, unknown>>()
  for (const r of completions) {
    if (!seen.has(r.module_id)) {
      seen.add(r.module_id)
      modulesInOrder.push({
        id: r.module_id,
        label: r.module && r.module.trim().length > 0 ? r.module : t("default-module"),
        hasNumericGrades: numericModuleIds.has(r.module_id),
      })
    }
    const existing = byUser.get(r.user_id) ?? {}
    existing[gradeKeyOf(r.module_id)] = r.grade ?? null
    existing[passedKeyOf(r.module_id)] = r.passed ?? null
    existing[registeredKeyOf(r.module_id)] = r.registered
    existing[needsReviewKeyOf(r.module_id)] = r.needs_to_be_reviewed
    byUser.set(r.user_id, existing)
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

const gradeLabel = (grade: unknown, passed: unknown, t: CreditRegistrationTFunction): string => {
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

/**
 * Room for a full name. Truncating the one column that identifies the row leaves a narrow screen
 * with a table of anonymous statuses.
 */
const STUDENT_COLUMN_MIN_WIDTH = 160

const GradeCell: React.FC<{
  grade: unknown
  passed: unknown
  needsReview: boolean
  isNumeric: boolean
}> = ({ grade, passed, needsReview, isNumeric }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <div className={cx(inlineCellCss, isNumeric && numericCellCss)}>
      <span>{gradeLabel(grade, passed, t)}</span>
      {needsReview && <CourseModuleCompletionNeedsReviewBadge />}
    </div>
  )
}

/**
 * The registry's own state when the ledger has a row, else the legacy registered flag.
 *
 * `isCreditRegistrationsPending` is true only while the index has never loaded at all; without it,
 * a row whose registration has not arrived yet renders the same "no registration" glyph as a row
 * that genuinely has none.
 */
const RegistrationCell: React.FC<{
  registered: boolean
  creditRegistration: CourseCreditRegistration | undefined
  isCreditRegistrationsPending: boolean
}> = ({ registered, creditRegistration, isCreditRegistrationsPending }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (creditRegistration) {
    return <CreditRegistrationStatusCell registration={creditRegistration} />
  }
  if (registered) {
    return <span>{t("registered")}</span>
  }
  if (isCreditRegistrationsPending) {
    return (
      <span aria-hidden="true">
        <Spinner variant="small" disableMargin />
      </span>
    )
  }
  return <span>{ABSENT}</span>
}

const buildColumns = (
  modulesInOrder: ModuleColumn[],
  t: CreditRegistrationTFunction,
  locale: string,
  creditRegistrations: CreditRegistrationIndex,
  isCreditRegistrationsPending: boolean,
): ColumnDef<StudentsTableFeatures, CompletionRow, unknown>[] => {
  const columns: ColumnDef<StudentsTableFeatures, CompletionRow, unknown>[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "last_name",
      header: t("label-student"),
      minSize: STUDENT_COLUMN_MIN_WIDTH,
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
              isCreditRegistrationsPending={isCreditRegistrationsPending}
            />
          ),
          meta: {
            measureValue: (row: CompletionRow) =>
              creditRegistrationCellText(
                t,
                creditRegistrations.get(creditRegistrationKey(row.user_id, moduleId)),
                locale,
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
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const { courseId, courseInstanceId, moduleId, registrationView, setRegistrationView } =
    useStudentsContext()
  const params = useStudentsListParams(DETAIL_SORT_COLUMNS)
  const { sorting, onSortingChange } = useStudentsSorting(DETAIL_SORT_COLUMNS)

  const identityQuery = useCourseStudentsIdentity(courseId, params)
  const identityRows = useMemo(() => identityQuery.data?.data ?? [], [identityQuery.data])
  const userIds = useMemo(() => identityRows.map((r) => r.user_id), [identityRows])
  const detailQuery = useCourseStudentsCompletionsDetail(courseId, userIds)
  const structureQuery = useCourseStructure(courseId)
  const structureModules = useMemo(() => structureQuery.data?.modules ?? [], [structureQuery.data])
  const {
    data: creditRegistrations,
    isAuthorized: canSeeCreditRegistrations,
    isPending: isCreditRegistrationsPending,
    isFetching: isCreditRegistrationsFetching,
  } = useTeacherCreditRegistrations(courseId, userIds)

  // Deferred *after* userIds/detailQuery are derived so a search/sort/page commit still fires the
  // detail request promptly -- only the expensive pivot below is deprioritized.
  const deferredIdentityRows = useDeferredValue(identityRows)
  const deferredDetailData = useDeferredValue(detailQuery.data)
  // The credit-registration index is fetched separately, keyed by the same user ids: while it is
  // refetching for a changed filter, a stale index may no longer match the (also stale) rows on
  // screen, so the table stays dimmed until both have caught up.
  const isStale =
    deferredIdentityRows !== identityRows ||
    deferredDetailData !== detailQuery.data ||
    isCreditRegistrationsFetching

  const { modulesInOrder, data } = useMemo(
    () => pivotCompletions(deferredIdentityRows, deferredDetailData ?? [], structureModules, t),
    [deferredIdentityRows, deferredDetailData, structureModules, t],
  )
  const columns = useMemo(
    () =>
      buildColumns(
        modulesInOrder,
        t,
        i18n.language,
        creditRegistrations,
        isCreditRegistrationsPending,
      ),
    [modulesInOrder, t, i18n.language, creditRegistrations, isCreditRegistrationsPending],
  )

  // The detail request is skipped while the page lists nobody, so a query that can never resolve
  // must stay out of the tuple.
  const queries = userIds.length > 0 ? [identityQuery, detailQuery] : [identityQuery]
  const isRosterEmpty = identityRows.length === 0 && !identityQuery.isPending

  return (
    <div className={sectionsCss}>
      {canSeeCreditRegistrations && (
        <CourseCreditRegistrationSummaryPanel
          courseId={courseId}
          courseInstanceId={courseInstanceId}
          moduleId={moduleId}
          registrationView={registrationView}
          onSelectView={setRegistrationView}
        />
      )}
      {/* Adding a completion by hand is the one way to seed a roster, so the actions outlive the
          empty state rather than appearing only once somebody has completed something. */}
      <CompletionsActions courseId={courseId} courseInstanceId={courseInstanceId} />
      {isRosterEmpty ? (
        <EmptyState
          title={t("credit-registration-completions-empty-title")}
          action={
            canSeeCreditRegistrations ? (
              <CreditRegistrationSetupNote courseId={courseId} />
            ) : undefined
          }
        />
      ) : (
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
      )}
    </div>
  )
}
