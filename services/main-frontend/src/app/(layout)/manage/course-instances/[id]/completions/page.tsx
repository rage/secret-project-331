"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { SortingState } from "@tanstack/react-table"
import { useParams } from "next/navigation"
import React, { useDeferredValue, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { QUIET_REFRESH } from "@/components/credit-registration/constants"
import CourseCreditRegistrationSummaryPanel from "@/components/credit-registration/CourseCreditRegistrationSummaryPanel"
import {
  cardCss,
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import type { CreditRegistrationIndex } from "@/components/credit-registration/teacherCreditRegistrations"
import { useTeacherCreditRegistrations } from "@/components/credit-registration/teacherCreditRegistrations"
import AddCompletionsForm from "@/components/forms/AddCompletionsForm"
import {
  getCourseInstanceCompletionsOptions,
  getCourseInstanceOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createCourseInstanceCompletions,
  previewCourseInstanceCompletions,
} from "@/generated/api/sdk.generated"
import type {
  ManualCompletionPreview,
  TeacherManualCompletionRequest,
} from "@/generated/api/types.generated"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Button,
  QueryResult,
  Select,
  StatTile,
  StatTileList,
  TextField,
} from "@/shared-module/components"

import CompletionRegistrationPreview from "../CompletionRegistrationPreview"
import CompletionsExportButton from "./CompletionsExportButton"
import type { CompletionsView } from "./completionsRows"
import {
  COMPLETIONS_VIEWS,
  DEFAULT_COMPLETIONS_VIEW,
  filterCompletionsRows,
  moduleSummaryOf,
  PREREQUISITE_FOOTNOTE_PREFIX,
  sortCompletionsRows,
  toCompletionsRows,
} from "./completionsRows"
import CompletionsTable, { STUDENT_COLUMN_ID } from "./CompletionsTable"

const EMPTY_CREDIT_REGISTRATIONS: CreditRegistrationIndex = new Map()

/** Ranks a pass carrying no numeric grade above a fail, for the preview's "previous best grade". */
const PASS_GRADE_VALUE = 0.5
const FAIL_GRADE_VALUE = -1

const VIEW_LABEL_KEYS = {
  everyone: "completions-view-everyone",
  needs_attention: "completions-view-needs-attention",
  awaiting_review: "completions-view-awaiting-review",
  not_completed: "completions-view-not-completed",
} as const satisfies Record<CompletionsView, string>

interface CompletionsControls {
  search: string
  view: CompletionsView
}

const headerRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: baseline;
  justify-content: space-between;
`

const pageHeadingCss = css`
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
`

const tableScrollCss = css`
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  width: 100%;
`

/** Whether the instance's credits went through and who is stuck, then every student's grades. */
const CompletionsPage: React.FC = () => {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const courseInstanceId = params.id

  const courseInstanceQuery = useQuery(
    getCourseInstanceOptions({ path: { course_instance_id: courseInstanceId } }),
  )
  const instanceName = courseInstanceQuery.data?.name || t("default-instance")
  const courseId = courseInstanceQuery.data?.course_id ?? null

  usePageTitle(
    courseInstanceQuery.isLoading ? null : joinTitleSegments([t("completions"), instanceName]),
    { order: 10 },
  )

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("completions") }], [t])
  useRegisterBreadcrumbs({
    key: `course-instance:${courseInstanceId}:completions`,
    order: 60,
    crumbs,
  })

  const completionsQuery = useQuery({
    ...getCourseInstanceCompletionsOptions({
      path: { course_instance_id: courseInstanceId },
    }),
    select: (completions) => ({
      sortedCourseModules: completions.course_modules.toSorted(
        (a, b) => a.order_number - b.order_number,
      ),
      rows: toCompletionsRows(completions.users_with_course_module_completions),
    }),
  })

  const listedUserIds = useMemo(
    () => completionsQuery.data?.rows.map((row) => row.userId) ?? [],
    [completionsQuery.data],
  )
  const { data: creditRegistrationsData, isAuthorized: canSeeCreditRegistrations } =
    useTeacherCreditRegistrations(courseId, listedUserIds)
  const creditRegistrations = creditRegistrationsData ?? EMPTY_CREDIT_REGISTRATIONS

  const { control, watch } = useForm<CompletionsControls>({
    defaultValues: { search: "", view: DEFAULT_COMPLETIONS_VIEW },
  })
  // Filtering scans every student of the instance, so it trails the keystrokes instead of blocking them.
  const search = useDeferredValue(watch("search"))
  const view = watch("view")
  const [sorting, setSorting] = useState<SortingState>([{ id: STUDENT_COLUMN_ID, desc: false }])

  const [showForm, setShowForm] = useState(false)
  const [completionFormData, setCompletionFormData] =
    useState<TeacherManualCompletionRequest | null>(null)
  const [previewData, setPreviewData] = useState<ManualCompletionPreview | null>(null)
  const addCompletionsMutation = useToastMutation(
    (data: TeacherManualCompletionRequest) =>
      createCourseInstanceCompletions({
        body: data,
        path: { course_instance_id: courseInstanceId },
      }),
    { notify: true, method: "POST", successMessage: t("completions-submitted-successfully") },
    {
      onSuccess: () => {
        setCompletionFormData(null)
        setPreviewData(null)
        setShowForm(false)
        completionsQuery.refetch()
      },
    },
  )

  const handlePostCompletionsPreview = async (
    data: TeacherManualCompletionRequest,
  ): Promise<void> => {
    setCompletionFormData(data)
    const preview = await previewCourseInstanceCompletions({
      body: data,
      path: { course_instance_id: courseInstanceId },
    })

    const alreadyCompletedUsers = preview.already_completed_users.map((user) => {
      const row = completionsQuery.data?.rows.find((candidate) => candidate.userId === user.user_id)
      const completions = row?.moduleCompletions.get(data.course_module_id)
      if (!completions) {
        return { ...user, previous_best_grade: null }
      }
      const bestGrade = completions.reduce((best, completion) => {
        const grade =
          completion.grade !== null && completion.grade !== undefined
            ? completion.grade
            : completion.passed
              ? PASS_GRADE_VALUE
              : FAIL_GRADE_VALUE
        return Math.max(best, grade)
      }, FAIL_GRADE_VALUE)
      return { ...user, previous_best_grade: bestGrade }
    })

    setPreviewData({ ...preview, already_completed_users: alreadyCompletedUsers })
  }

  return (
    <div className={sectionsCss}>
      <div className={headerRowCss}>
        <div>
          <h1 className={pageHeadingCss}>{t("completions")}</h1>
          <p className={noteCss}>{instanceName}</p>
        </div>
        <CompletionsExportButton courseInstanceId={courseInstanceId} />
      </div>

      {canSeeCreditRegistrations && courseId !== null && (
        <CourseCreditRegistrationSummaryPanel courseId={courseId} />
      )}

      <QueryResult query={completionsQuery} treatEmptyAsData refreshIndicator={QUIET_REFRESH}>
        {({ sortedCourseModules, rows }) => {
          const moduleIds = sortedCourseModules.map((module) => module.id)
          const shown = sortCompletionsRows(
            filterCompletionsRows(rows, { search, view, moduleIds, creditRegistrations }),
            sorting,
            STUDENT_COLUMN_ID,
          )
          const anyPrerequisiteMissing = shown.some((row) =>
            moduleIds.some(
              (moduleId) =>
                moduleSummaryOf(row, moduleId).latest?.prerequisite_modules_completed === false,
            ),
          )
          return (
            <>
              <section className={sectionCss}>
                <h2 className={headingCss}>{t("heading-completions-per-module")}</h2>
                <StatTileList ariaLabel={t("heading-completions-per-module")}>
                  <StatTile label={t("number-of-students")} value={rows.length} />
                  {sortedCourseModules.map((module) => (
                    <StatTile
                      key={module.id}
                      label={module.name ?? t("label-default")}
                      value={rows.filter((row) => row.moduleCompletions.has(module.id)).length}
                    />
                  ))}
                </StatTileList>
              </section>

              <section className={sectionCss}>
                <div className={controlsCss}>
                  <TextField
                    name="search"
                    control={control}
                    className={controlCss}
                    label={t("label-search-students")}
                    type="search"
                  />
                  <Select
                    name="view"
                    control={control}
                    className={controlCss}
                    label={t("label-show")}
                    options={COMPLETIONS_VIEWS.map((value) => ({
                      value,
                      label: t(VIEW_LABEL_KEYS[value]),
                    }))}
                  />
                  <Button
                    variant="secondary"
                    size="medium"
                    type="button"
                    onClick={() => setShowForm(!showForm)}
                  >
                    {t("manually-add-completions")}
                  </Button>
                </div>
                <p className={noteCss}>
                  {t("completions-shown-of-total", { shown: shown.length, total: rows.length })}
                </p>
                {showForm && (
                  <div className={cardCss}>
                    <AddCompletionsForm
                      onSubmit={handlePostCompletionsPreview}
                      courseModules={sortedCourseModules}
                      submitText={t("button-text-check")}
                    />
                    {previewData && completionFormData && (
                      <CompletionRegistrationPreview
                        manualCompletionPreview={previewData}
                        onSubmit={(options) => {
                          addCompletionsMutation.mutate({
                            ...completionFormData,
                            skip_duplicate_completions: options.skipDuplicateCompletions,
                          })
                        }}
                      />
                    )}
                  </div>
                )}
              </section>

              <BreakFromCentered sidebar={false}>
                <div className={tableScrollCss} data-students-horizontal-scroll>
                  <CompletionsTable
                    courseId={courseId}
                    sortedCourseModules={sortedCourseModules}
                    rows={shown}
                    creditRegistrations={creditRegistrations}
                    sorting={sorting}
                    onSortingChange={setSorting}
                  />
                </div>
              </BreakFromCentered>
              {anyPrerequisiteMissing && (
                <p className={noteCss}>
                  {PREREQUISITE_FOOTNOTE_PREFIX}
                  {t("module-is-completed-but-requires-completion-of-prerequisite-modules")}
                </p>
              )}
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CompletionsPage))
