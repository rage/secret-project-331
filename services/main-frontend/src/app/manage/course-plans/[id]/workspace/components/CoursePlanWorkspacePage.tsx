"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { coursePlanQueryKeys } from "../../../coursePlanQueryKeys"
import { SCHEDULE_STAGE_ORDER } from "../../schedule/scheduleConstants"

import CompactPhaseStatusWidget from "./CompactPhaseStatusWidget"
import PlanOverviewPanel, { type OverviewStage } from "./PlanOverviewPanel"
import WorkspaceStageSection from "./WorkspaceStageSection"

import {
  advanceCourseDesignerStage,
  type CourseDesignerPlanStageWithTasks,
  type CourseDesignerStage,
  extendCourseDesignerStage,
  getCourseDesignerPlan,
  startCourseDesignerPlan,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const pageRootStyles = css`
  padding: 2rem 0 3rem 0;
  min-height: 100vh;
`

const workspaceShellStyles = css`
  width: 100%;
  margin: 0 auto;
  padding: 0 1.25rem 3rem;

  ${respondToOrLarger.md} {
    padding: 0 1.75rem 3rem;
  }

  ${respondToOrLarger.lg} {
    padding: 0 2.25rem 3rem;
  }

  ${respondToOrLarger.xl} {
    padding: 0 2.75rem 3rem;
  }

  ${respondToOrLarger.xxxl} {
    padding: 0 3rem 3rem;
  }
`

const headerRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
`

const headerBlockStyles = css`
  flex: 1;
  min-width: 0;
`

const titleStyles = css`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.25rem 0;
`

const metadataRowStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
  margin: 0;
`

const workspaceGridStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "header"
    "instructions"
    "tasks"
    "workspace"
    "chatbot";
  grid-auto-rows: minmax(0, auto);
  gap: 1.25rem;

  ${respondToOrLarger.sm} {
    gap: 1.5rem;
  }

  ${respondToOrLarger.md} {
    gap: 1.6rem;
  }

  ${respondToOrLarger.lg} {
    gap: 1.6rem;
  }

  ${respondToOrLarger.xl} {
    grid-template-columns:
      minmax(24rem, 1.35fr)
      minmax(34rem, 2.1fr);
    grid-template-areas:
      "header header"
      "tasks instructions"
      "tasks workspace"
      "chatbot workspace";
    gap: 1.75rem;
  }

  ${respondToOrLarger.xxl} {
    grid-template-columns:
      minmax(26rem, 1.35fr)
      minmax(40rem, 2.1fr);
    grid-template-areas:
      "header header"
      "tasks instructions"
      "tasks workspace"
      "chatbot workspace";
    gap: 2rem;
  }

  ${respondToOrLarger.xxxxl} {
    grid-template-columns:
      minmax(24rem, 1.2fr)
      minmax(40rem, 2.6fr)
      minmax(24rem, 1.3fr);
    grid-template-areas:
      "header header header"
      "tasks instructions chatbot"
      "tasks workspace chatbot"
      "tasks workspace chatbot";
    gap: 2.25rem;
    align-items: flex-start;
  }
`

const headerAreaStyles = css`
  grid-area: header;
`

const instructionsAreaStyles = css`
  grid-area: instructions;
`

const tasksAreaStyles = css`
  grid-area: tasks;
`

const workspaceAreaStyles = css`
  grid-area: workspace;
`

const chatbotAreaStyles = css`
  grid-area: chatbot;
`

const cardStyles = css`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  border: 1px solid ${baseTheme.colors.gray[200]};
`

const tasksCardStyles = css`
  min-height: 80vh;
  display: flex;
  flex-direction: column;
`

const workspaceCardStyles = css`
  min-height: 60vh;
  display: flex;
  flex-direction: column;
`

const chatbotCardStyles = css`
  display: flex;
  flex-direction: column;
  min-height: 80vh;
`

const sectionTitleStyles = css`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.5rem 0;
`

const instructionsSectionTitleStyles = css`
  font-size: 1.15rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.5rem 0;
`

const aboutHeadingStyles = css`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0 0 0.35rem 0;
`

const aboutTextStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.55;
  margin: 0 0 0.75rem 0;
`

const keyGoalsHeadingStyles = css`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0 0 0.35rem 0;
`

const keyGoalsListStyles = css`
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.5;
`

const keyGoalItemStyles = css`
  padding: 0.2rem 0;
  padding-left: 1.25rem;
  position: relative;

  ::before {
    content: "•";
    position: absolute;
    left: 0;
    color: ${baseTheme.colors.green[600]};
  }
`

const emptyStateStyles = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.95rem;
  font-style: italic;
`

function daysBetween(from: string, to: string): number {
  const a = new Date(from)
  const b = new Date(to)
  const diff = b.getTime() - a.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function CoursePlanWorkspacePage() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ""
  const queryClient = useQueryClient()
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)

  const planQuery = useQuery({
    queryKey: coursePlanQueryKeys.detail(planId),
    queryFn: () => getCourseDesignerPlan(planId),
    enabled: !!planId,
  })

  const startMutation = useToastMutation(
    () => startCourseDesignerPlan(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const extendMutation = useToastMutation(
    (params: { stage: CourseDesignerStage; months: number }) =>
      extendCourseDesignerStage(planId, params.stage, params.months),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const advanceMutation = useToastMutation(
    () => advanceCourseDesignerStage(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      },
    },
  )

  const stageLabel = useCallback(
    (stage: CourseDesignerStage) => {
      // eslint-disable-next-line i18next/no-literal-string
      const key = `course-plans-stage-${stage.toLowerCase()}`
      return t(
        key as
          | "course-plans-stage-analysis"
          | "course-plans-stage-design"
          | "course-plans-stage-development"
          | "course-plans-stage-implementation"
          | "course-plans-stage-evaluation",
      )
    },
    [t],
  )

  if (planQuery.isError) {
    return (
      <div className={pageRootStyles}>
        <div className={workspaceShellStyles}>
          <ErrorBanner variant="readOnly" error={planQuery.error} />
        </div>
      </div>
    )
  }

  if (planQuery.isLoading || !planQuery.data) {
    return (
      <div className={pageRootStyles}>
        <div className={workspaceShellStyles}>
          <Spinner variant="medium" />
        </div>
      </div>
    )
  }

  const { plan, stages } = planQuery.data

  if (plan.status === "ReadyToStart" && !plan.active_stage) {
    return (
      <div className={pageRootStyles}>
        <div className={workspaceShellStyles}>
          <h1 className={titleStyles}>{plan.name ?? t("course-plans-untitled-plan")}</h1>
          <div className={cardStyles}>
            <p>{t("course-plans-status-ready-to-start")}</p>
            <Button
              variant="primary"
              size="medium"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {t("course-plans-start-plan")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const currentStage = plan.active_stage
  const currentStageData = currentStage ? stages.find((s) => s.stage === currentStage) : null

  const today = new Date().toISOString().slice(0, 10)
  let timeRemainingText: string | null = null
  let timeRemainingShort: string | null = null
  let daysLeft: number | null = null
  if (currentStageData) {
    const days = daysBetween(today, currentStageData.planned_ends_on)
    daysLeft = days
    if (days > 0) {
      const months = Math.floor(days / 30)
      const remainingDays = days % 30
      timeRemainingText = t("course-plans-time-remaining-summary", {
        months,
        days: remainingDays,
      })
      timeRemainingShort =
        days <= 31 ? t("course-plans-days-left", { count: days }) : timeRemainingText
    } else if (days < 0) {
      timeRemainingText = t("course-plans-time-remaining-overdue", {
        count: -days,
        stage: stageLabel(currentStageData.stage),
      })
      timeRemainingShort = timeRemainingText
    }
  }

  const tasksRemainingCount =
    currentStageData?.tasks != null
      ? currentStageData.tasks.filter((task) => !task.is_completed).length
      : -1
  const isUrgent = daysLeft != null && daysLeft <= 0

  const lastEditedText = plan.updated_at
    ? t("course-plans-last-edited", {
        time: new Date(plan.updated_at).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      })
    : null

  const currentPhaseEndDateFormatted =
    currentStageData?.planned_ends_on != null
      ? new Date(currentStageData.planned_ends_on).toLocaleDateString(i18n.language, {
          // eslint-disable-next-line i18next/no-literal-string -- Intl date format keys
          month: "long",
          // eslint-disable-next-line i18next/no-literal-string -- Intl date format keys
          year: "numeric",
        })
      : null

  const activeStageTaskCompleted =
    currentStageData?.tasks != null
      ? currentStageData.tasks.filter((task) => task.is_completed).length
      : 0
  const activeStageTaskTotal = currentStageData?.tasks != null ? currentStageData.tasks.length : 0
  const currentStageIndex = currentStage ? SCHEDULE_STAGE_ORDER.indexOf(currentStage) : -1
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < SCHEDULE_STAGE_ORDER.length - 1
      ? SCHEDULE_STAGE_ORDER[currentStageIndex + 1]
      : null
  const nextStageLabel = nextStage ? stageLabel(nextStage) : null

  const canAct =
    plan.status === "InProgress" &&
    currentStage &&
    currentStageData &&
    currentStageData.status !== "Completed"

  const currentStageSection =
    currentStageData && currentStage ? (
      <WorkspaceStageSection
        key={currentStageData.id}
        planId={planId}
        stage={currentStageData as CourseDesignerPlanStageWithTasks}
        stageLabel={stageLabel(currentStage)}
        isActive
        showStageTitle={false}
        onInvalidate={() =>
          void queryClient.invalidateQueries({
            queryKey: coursePlanQueryKeys.detail(planId),
          })
        }
      />
    ) : null

  const stageDescriptionItems =
    currentStage === "Analysis"
      ? [
          t("course-plans-stage-description-analysis-1"),
          t("course-plans-stage-description-analysis-2"),
          t("course-plans-stage-description-analysis-3"),
          t("course-plans-stage-description-analysis-4"),
          t("course-plans-stage-description-analysis-5"),
        ]
      : currentStage === "Design"
        ? [
            t("course-plans-stage-description-design-1"),
            t("course-plans-stage-description-design-2"),
            t("course-plans-stage-description-design-3"),
            t("course-plans-stage-description-design-4"),
            t("course-plans-stage-description-design-5"),
          ]
        : currentStage === "Development"
          ? [
              t("course-plans-stage-description-development-1"),
              t("course-plans-stage-description-development-2"),
            ]
          : currentStage === "Implementation"
            ? [
                t("course-plans-stage-description-implementation-1"),
                t("course-plans-stage-description-implementation-2"),
                t("course-plans-stage-description-implementation-3"),
              ]
            : currentStage === "Evaluation"
              ? [
                  t("course-plans-stage-description-evaluation-1"),
                  t("course-plans-stage-description-evaluation-2"),
                ]
              : []

  const keyGoalsContent =
    currentStage && stageDescriptionItems.length > 0
      ? stageDescriptionItems.map((line, index) => (
          <li key={`${currentStage}-${index}`} className={keyGoalItemStyles}>
            {line}
          </li>
        ))
      : [
          <li key="generic-1" className={keyGoalItemStyles}>
            {t("course-plans-key-goal-1")}
          </li>,
          <li key="generic-2" className={keyGoalItemStyles}>
            {t("course-plans-key-goal-2")}
          </li>,
          <li key="generic-3" className={keyGoalItemStyles}>
            {t("course-plans-key-goal-3")}
          </li>,
        ]

  return (
    <BreakFromCentered sidebar={false}>
      <div className={pageRootStyles}>
        <PlanOverviewPanel
          isOpen={isOverviewOpen}
          onClose={() => setIsOverviewOpen(false)}
          planName={plan.name ?? t("course-plans-untitled-plan")}
          stages={stages as OverviewStage[]}
          activeStage={currentStage ?? null}
          stageLabel={stageLabel}
          canActOnCurrentStage={Boolean(canAct)}
          onExtendCurrentStage={(months) =>
            currentStage && extendMutation.mutate({ stage: currentStage, months })
          }
          onAdvanceStage={() => advanceMutation.mutate()}
          isExtendPending={extendMutation.isPending}
          isAdvancePending={advanceMutation.isPending}
          timeRemainingText={timeRemainingText}
          timeRemainingShort={timeRemainingShort}
          currentPhaseEndDateFormatted={currentPhaseEndDateFormatted}
          activeStageTaskCompleted={activeStageTaskCompleted}
          activeStageTaskTotal={activeStageTaskTotal}
          nextStageLabel={nextStageLabel}
        />

        <div className={workspaceShellStyles}>
          <div className={workspaceGridStyles}>
            <div className={headerAreaStyles}>
              <div className={headerRowStyles}>
                <div className={headerBlockStyles}>
                  <h1 className={titleStyles}>{plan.name ?? t("course-plans-untitled-plan")}</h1>
                  {lastEditedText && <p className={metadataRowStyles}>{lastEditedText}</p>}
                </div>
                {currentStage && (
                  <CompactPhaseStatusWidget
                    phaseName={stageLabel(currentStage)}
                    statusTimeLine={
                      (timeRemainingShort ?? timeRemainingText)
                        ? t("course-plans-status-with-time", {
                            time: timeRemainingShort ?? timeRemainingText,
                          })
                        : t("course-plans-status-in-progress")
                    }
                    tasksRemainingCount={tasksRemainingCount}
                    isUrgent={isUrgent}
                    onClick={() => setIsOverviewOpen(true)}
                  />
                )}
              </div>
            </div>

            <section
              className={`${cardStyles} ${instructionsAreaStyles}`}
              aria-label={t("course-plans-instructions-aria-label")}
            >
              <h2 className={instructionsSectionTitleStyles}>
                {t("course-plans-instructions-heading")}
              </h2>
              <p className={aboutHeadingStyles}>{t("course-plans-about-this-phase")}</p>
              <p className={aboutTextStyles}>
                {currentStage
                  ? t(
                      `course-plans-phase-brief-${currentStage.toLowerCase()}` as
                        | "course-plans-phase-brief-analysis"
                        | "course-plans-phase-brief-design"
                        | "course-plans-phase-brief-development"
                        | "course-plans-phase-brief-implementation"
                        | "course-plans-phase-brief-evaluation",
                    )
                  : t("course-plans-instructions-placeholder")}
              </p>
              <p className={keyGoalsHeadingStyles}>{t("course-plans-key-goals")}</p>
              <ul className={keyGoalsListStyles}>{keyGoalsContent}</ul>
            </section>

            <section
              className={`${cardStyles} ${tasksAreaStyles} ${tasksCardStyles}`}
              aria-label={t("course-plans-tasks-aria-label")}
            >
              <h2 className={sectionTitleStyles}>{t("course-plans-tasks-heading")}</h2>
              {currentStageSection ?? (
                <p className={emptyStateStyles}>{t("course-plans-no-active-stage")}</p>
              )}
            </section>

            <section
              className={`${cardStyles} ${workspaceAreaStyles} ${workspaceCardStyles}`}
              aria-label={t("course-plans-workspace-aria-label")}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <h2 className={sectionTitleStyles}>Workspace</h2>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <p className={aboutTextStyles}>
                This area will host tools and editors for working on the current stage of your
                course design.
              </p>
            </section>

            <section
              className={`${cardStyles} ${chatbotAreaStyles} ${chatbotCardStyles}`}
              aria-label={t("course-plans-assistant-aria-label")}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <h2 className={sectionTitleStyles}>Assistant</h2>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <p className={aboutTextStyles}>
                A course design assistant chatbot will appear here to help you with tasks and
                questions about each stage.
              </p>
            </section>
          </div>
        </div>
      </div>
    </BreakFromCentered>
  )
}
