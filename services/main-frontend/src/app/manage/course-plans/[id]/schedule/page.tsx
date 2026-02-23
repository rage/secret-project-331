"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  CourseDesignerCourseSize,
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
  finalizeCourseDesignerSchedule,
  generateCourseDesignerScheduleSuggestion,
  getCourseDesignerPlan,
  saveCourseDesignerSchedule,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const containerStyles = css`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
`

const sectionStyles = css`
  background: white;
  border: 1px solid #d9dde4;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
`

const rowStyles = css`
  display: grid;
  grid-template-columns: 180px minmax(140px, 1fr) minmax(140px, 1fr);
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`

const toolbarStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
`

const fieldStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  input,
  select {
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid #c8cfda;
    font: inherit;
  }
`

const tableHeaderStyles = css`
  ${rowStyles};
  font-weight: 700;
  color: #4f5b6d;
`

const todayDateInputValue = () => new Date().toISOString().slice(0, 10)

// eslint-disable-next-line i18next/no-literal-string
const COURSE_DESIGNER_PLAN_QUERY_KEY = "course-designer-plan"
// eslint-disable-next-line i18next/no-literal-string
const COURSE_DESIGNER_PLANS_QUERY_KEY = "course-designer-plans"

function CoursePlanSchedulePage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const planId = params.id

  const planQuery = useQuery({
    queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId],
    queryFn: () => getCourseDesignerPlan(planId),
  })

  const [planName, setPlanName] = useState("")
  // eslint-disable-next-line i18next/no-literal-string
  const [courseSize, setCourseSize] = useState<CourseDesignerCourseSize>("medium")
  const [startsOn, setStartsOn] = useState(todayDateInputValue())
  const [draftStages, setDraftStages] = useState<Array<CourseDesignerScheduleStageInput>>([])
  const [initializedFromQuery, setInitializedFromQuery] = useState<string | null>(null)

  const stageLabel = (stage: CourseDesignerStage) => {
    switch (stage) {
      // eslint-disable-next-line i18next/no-literal-string
      case "Analysis":
        return t("course-plans-stage-analysis")
      // eslint-disable-next-line i18next/no-literal-string
      case "Design":
        return t("course-plans-stage-design")
      // eslint-disable-next-line i18next/no-literal-string
      case "Development":
        return t("course-plans-stage-development")
      // eslint-disable-next-line i18next/no-literal-string
      case "Implementation":
        return t("course-plans-stage-implementation")
      // eslint-disable-next-line i18next/no-literal-string
      case "Evaluation":
        return t("course-plans-stage-evaluation")
    }
  }

  const validateStages = (stages: Array<CourseDesignerScheduleStageInput>): string | null => {
    if (stages.length !== 5) {
      return t("course-plans-validation-stage-count")
    }

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      if (stage.planned_starts_on > stage.planned_ends_on) {
        return t("course-plans-validation-stage-range", { stage: stageLabel(stage.stage) })
      }
      if (i > 0) {
        // eslint-disable-next-line i18next/no-literal-string
        const previous = new Date(`${stages[i - 1].planned_ends_on}T00:00:00Z`)
        previous.setUTCDate(previous.getUTCDate() + 1)
        const expected = previous.toISOString().slice(0, 10)
        if (stage.planned_starts_on !== expected) {
          return t("course-plans-validation-contiguous")
        }
      }
    }

    return null
  }

  useEffect(() => {
    if (!planQuery.data || initializedFromQuery === planId) {
      return
    }
    setPlanName(planQuery.data.plan.name ?? "")
    if (planQuery.data.stages.length > 0) {
      setDraftStages(
        planQuery.data.stages.map((stage) => ({
          stage: stage.stage,
          planned_starts_on: stage.planned_starts_on,
          planned_ends_on: stage.planned_ends_on,
        })),
      )
      setStartsOn(planQuery.data.stages[0].planned_starts_on)
    }
    setInitializedFromQuery(planId)
  }, [initializedFromQuery, planId, planQuery.data])

  const suggestionMutation = useToastMutation(
    () =>
      generateCourseDesignerScheduleSuggestion(planId, {
        course_size: courseSize,
        starts_on: startsOn,
      }),
    { notify: true, method: "POST" },
    {
      onSuccess: (result) => {
        setDraftStages(result.stages)
      },
    },
  )

  const saveMutation = useToastMutation(
    () =>
      saveCourseDesignerSchedule(planId, {
        name: planName.trim() === "" ? null : planName.trim(),
        stages: draftStages,
      }),
    { notify: true, method: "PUT" },
    {
      onSuccess: async (details) => {
        setDraftStages(
          details.stages.map((stage) => ({
            stage: stage.stage,
            planned_starts_on: stage.planned_starts_on,
            planned_ends_on: stage.planned_ends_on,
          })),
        )
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId] })
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
      },
    },
  )

  const finalizeMutation = useToastMutation(
    () => finalizeCourseDesignerSchedule(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId] })
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
      },
    },
  )

  const validationError = useMemo(() => validateStages(draftStages), [draftStages, t])

  if (planQuery.isError) {
    return <ErrorBanner variant="readOnly" error={planQuery.error} />
  }

  if (planQuery.isLoading || !planQuery.data) {
    return <Spinner variant="medium" />
  }

  return (
    <div className={containerStyles}>
      <h1>{t("course-plans-schedule-title")}</h1>

      <div className={sectionStyles}>
        <div className={fieldStyles}>
          <label htmlFor="course-plan-name">{t("course-plans-plan-name-label")}</label>
          <input
            id="course-plan-name"
            type="text"
            value={planName}
            onChange={(event) => setPlanName(event.target.value)}
            placeholder={t("course-plans-untitled-plan")}
          />
        </div>
        <p
          className={css`
            margin-top: 0.75rem;
            color: #5d6776;
          `}
        >
          {t("course-plans-schedule-summary", {
            status: planQuery.data.plan.status,
            members: planQuery.data.members.length,
            activeStage: planQuery.data.plan.active_stage
              ? stageLabel(planQuery.data.plan.active_stage)
              : t("course-plans-none"),
          })}
        </p>
      </div>

      <div className={sectionStyles}>
        <h2>{t("course-plans-generate-suggested-schedule")}</h2>
        <div className={toolbarStyles}>
          <div className={fieldStyles}>
            <label htmlFor="course-size">{t("course-plans-course-size-label")}</label>
            <select
              id="course-size"
              value={courseSize}
              onChange={(event) => setCourseSize(event.target.value as CourseDesignerCourseSize)}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <option value="small">{t("course-plans-course-size-small")}</option>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <option value="medium">{t("course-plans-course-size-medium")}</option>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <option value="large">{t("course-plans-course-size-large")}</option>
            </select>
          </div>

          <div className={fieldStyles}>
            <label htmlFor="starts-on">{t("course-plans-starts-on-label")}</label>
            <input
              id="starts-on"
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </div>

          <Button
            variant="secondary"
            size="medium"
            onClick={() => suggestionMutation.mutate()}
            disabled={suggestionMutation.isPending || startsOn.trim() === ""}
          >
            {t("course-plans-generate-suggestion")}
          </Button>
        </div>
      </div>

      <div className={sectionStyles}>
        <h2>{t("course-plans-schedule-editor-title")}</h2>
        <div className={tableHeaderStyles}>
          <div>{t("course-plans-stage-column")}</div>
          <div>{t("course-plans-start-date-column")}</div>
          <div>{t("course-plans-end-date-column")}</div>
        </div>

        {draftStages.length === 0 && <p>{t("course-plans-schedule-empty-help")}</p>}

        {draftStages.map((stage, index) => (
          <div key={stage.stage} className={rowStyles}>
            <div>{stageLabel(stage.stage)}</div>
            <input
              type="date"
              value={stage.planned_starts_on}
              onChange={(event) => {
                setDraftStages((current) =>
                  current.map((item, currentIndex) =>
                    currentIndex === index
                      ? { ...item, planned_starts_on: event.target.value }
                      : item,
                  ),
                )
              }}
            />
            <input
              type="date"
              value={stage.planned_ends_on}
              onChange={(event) => {
                setDraftStages((current) =>
                  current.map((item, currentIndex) =>
                    currentIndex === index
                      ? { ...item, planned_ends_on: event.target.value }
                      : item,
                  ),
                )
              }}
            />
          </div>
        ))}

        {validationError && (
          <div
            className={css`
              margin-top: 0.75rem;
              color: #8d2323;
              font-weight: 600;
            `}
          >
            {validationError}
          </div>
        )}

        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1rem;
          `}
        >
          <Button
            variant="primary"
            size="medium"
            disabled={
              draftStages.length !== 5 || validationError !== null || saveMutation.isPending
            }
            onClick={() => saveMutation.mutate()}
          >
            {t("course-plans-save-schedule")}
          </Button>
          <Button
            variant="secondary"
            size="medium"
            disabled={
              draftStages.length !== 5 ||
              validationError !== null ||
              finalizeMutation.isPending ||
              saveMutation.isPending
            }
            onClick={() => finalizeMutation.mutate()}
          >
            {t("course-plans-finalize-schedule")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanSchedulePage))
