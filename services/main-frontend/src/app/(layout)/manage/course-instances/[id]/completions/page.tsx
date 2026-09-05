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
import CourseCreditRegistrationSummaryPanel, {
  CreditRegistrationSummaryLine,
} from "@/components/credit-registration/CourseCreditRegistrationSummaryPanel"
import {
  cardCss,
  controlCss,
  controlsCss,
  noteCss,
  pageTitleCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
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
  CourseInstanceCompletionSummary,
  ManualCompletionPreview,
  TeacherManualCompletionRequest,
} from "@/generated/api/types.generated"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, QueryResult, Select, TextField } from "@/shared-module/components"

import CompletionRegistrationPreview from "../CompletionRegistrationPreview"
import CompletionsExportButton from "./CompletionsExportButton"
import type { CompletionsView } from "./completionsRows"
import {
  COMPLETIONS_VIEWS,
  DEFAULT_COMPLETIONS_VIEW,
  FAIL_GRADE_VALUE,
  filterCompletionsRows,
  gradeSortValue,
  moduleSummaryOf,
  PREREQUISITE_FOOTNOTE_PREFIX,
  sortCompletionsRows,
  STUDENT_COLUMN_ID,
  toCompletionsRows,
} from "./completionsRows"
import CompletionsTable from "./CompletionsTable"

/** Hoisted out of the query options: React Query only memoizes a `select` of stable identity. */
const selectCompletionsRows = (completions: CourseInstanceCompletionSummary) => ({
  sortedCourseModules: completions.course_modules.toSorted(
    (a, b) => a.order_number - b.order_number,
  ),
  rows: toCompletionsRows(completions.users_with_course_module_completions),
})

const NEEDS_ATTENTION_VIEW: CompletionsView = "needs_attention"

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
  gap: var(--space-4);
  align-items: baseline;
  justify-content: space-between;
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
    select: selectCompletionsRows,
  })
  const completions = completionsQuery.data

  const listedUserIds = useMemo(
    () => completions?.rows.map((row) => row.userId) ?? [],
    [completions],
  )
  const { data: creditRegistrations, isAuthorized: canSeeCreditRegistrations } =
    useTeacherCreditRegistrations(courseId, listedUserIds)

  const { control, watch, setValue } = useForm<CompletionsControls>({
    defaultValues: { search: "", view: DEFAULT_COMPLETIONS_VIEW },
  })
  // Filtering scans every student of the instance, so it trails the keystrokes instead of blocking them.
  const search = useDeferredValue(watch("search"))
  const view = watch("view")
  const [sorting, setSorting] = useState<SortingState>([{ id: STUDENT_COLUMN_ID, desc: false }])

  const moduleIds = useMemo(
    () => completions?.sortedCourseModules.map((module) => module.id) ?? [],
    [completions],
  )
  // For identity as much as for cost: a fresh array rebuilds the table's columns and row model.
  const shown = useMemo(
    () =>
      completions === undefined
        ? []
        : sortCompletionsRows(
            filterCompletionsRows(completions.rows, {
              search,
              view,
              moduleIds,
              creditRegistrations,
            }),
            sorting,
          ),
    [completions, search, view, moduleIds, creditRegistrations, sorting],
  )
  const anyPrerequisiteMissing = useMemo(
    () =>
      shown.some((row) =>
        moduleIds.some(
          (moduleId) =>
            moduleSummaryOf(row, moduleId).latest?.prerequisite_modules_completed === false,
        ),
      ),
    [shown, moduleIds],
  )

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
      const row = completions?.rows.find((candidate) => candidate.userId === user.user_id)
      const moduleAttempts = row?.moduleCompletions.get(data.course_module_id)
      if (!moduleAttempts) {
        return { ...user, previous_best_grade: null }
      }
      const bestGrade = moduleAttempts.reduce(
        (best, completion) => Math.max(best, gradeSortValue(completion.grade, completion.passed)),
        FAIL_GRADE_VALUE,
      )
      return { ...user, previous_best_grade: bestGrade }
    })

    setPreviewData({ ...preview, already_completed_users: alreadyCompletedUsers })
  }

  return (
    <div className={sectionsCss}>
      <div className={headerRowCss}>
        <div>
          <h1 className={pageTitleCss}>{t("completions")}</h1>
          <p className={noteCss}>{instanceName}</p>
        </div>
        <CompletionsExportButton courseInstanceId={courseInstanceId} />
      </div>

      {canSeeCreditRegistrations && courseId !== null && (
        <CreditRegistrationSummaryLine
          courseId={courseId}
          onShowNeedsAttention={() => setValue("view", NEEDS_ATTENTION_VIEW)}
        />
      )}

      <QueryResult query={completionsQuery} treatEmptyAsData refreshIndicator={QUIET_REFRESH}>
        {({ sortedCourseModules, rows }) => (
          <>
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
              {anyPrerequisiteMissing && (
                <p className={noteCss}>
                  {PREREQUISITE_FOOTNOTE_PREFIX}
                  {t("module-is-completed-but-requires-completion-of-prerequisite-modules")}
                </p>
              )}
            </BreakFromCentered>
          </>
        )}
      </QueryResult>

      {canSeeCreditRegistrations && courseId !== null && (
        <CourseCreditRegistrationSummaryPanel courseId={courseId} />
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CompletionsPage))
