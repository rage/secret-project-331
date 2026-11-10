"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useParams, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import {
  advanceCourseDesignerStageMutation,
  extendCourseDesignerStageMutation,
  getCourseDesignerPlanOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseDesignerStage } from "@/generated/api/types.generated"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageCoursePlanPermissionsRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Link, QueryResult, useDialog } from "@/shared-module/components"

import { formatPlanMonthYear } from "../../coursePlanDates"
import { stageLabel as translateStageLabel } from "../../coursePlanStages"
import { useInvalidatePlan } from "../../hooks/useInvalidatePlan"
import { CoursePlanAssistantPanel } from "../assistant/CoursePlanAssistant"
import { SCHEDULE_STAGE_ORDER } from "../schedule/scheduleConstants"
import ActiveStageDeadlineCard from "./components/ActiveStageDeadlineCard"
import MoocDesignOverview from "./components/overview/MoocDesignOverview"
import PlanOverviewPanel from "./components/PlanOverviewPanel"
import { SectionStatusProvider } from "./components/section-status/SectionStatusContext"
import { MOOC_DESIGN_TAB } from "./components/stageTimelineShared"
import StageTimelineTabStrip from "./components/StageTimelineTabStrip"
import StageWorkspaceContent from "./components/StageWorkspaceContent"
import WorkspaceStageSection from "./components/WorkspaceStageSection"
import { useCoursePlanWorkspacePageState } from "./hooks/useCoursePlanWorkspacePageState"

const pageRootStyles = css`
  padding: 0 0 3rem 0;
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

const manageMembersLinkStyles = css`
  font-size: 0.9rem;
  font-weight: 500;
  color: ${baseTheme.colors.green[700]};
  text-decoration: none;
  white-space: nowrap;
  align-self: center;

  &:hover {
    color: ${baseTheme.colors.green[800]};
    text-decoration: underline;
  }
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
      "tasks workspace chatbot";
    gap: 2.25rem;
    align-items: flex-start;
  }
`

const overviewGridStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.75rem;

  ${respondToOrLarger.xl} {
    grid-template-columns: minmax(34rem, 2.6fr) minmax(24rem, 1.3fr);
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

/** Keeps the chat usable beside long forms: its own scroll area, pinned while the page scrolls. */
const chatbotPanelStyles = css`
  height: min(80vh, 56rem);

  ${respondToOrLarger.xl} {
    position: sticky;
    top: 1rem;
  }
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

const sectionTitleStyles = css`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.5rem 0;
`

const currentStageTitleStyles = css`
  font-size: 1.35rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[900]};
  margin: 0.55rem 0 0.75rem;
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

const stageContextNoticeStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.85rem 1rem;
  margin: 0 0 1rem 0;
  border-radius: 10px;
  background: ${baseTheme.colors.gray[50]};
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-left: 3px solid ${baseTheme.colors.gray[300]};
`

const stageContextNoticeFutureStyles = css`
  background: ${baseTheme.colors.primary[100]};
  border-color: ${baseTheme.colors.gray[200]};
  border-left-color: ${baseTheme.colors.green[400]};
`

const stageContextEyebrowStyles = css`
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${baseTheme.colors.gray[500]};
  margin: 0;
`

const stageContextTitleStyles = css`
  font-size: 1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0;
`

const stageContextBodyStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
  line-height: 1.5;
`

const stageContextActionRowStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
`

const welcomeDialogBodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[700]};
  line-height: 1.55;
`

const welcomeDialogIntroStyles = css`
  margin: 0;
  font-size: 1rem;
  color: ${baseTheme.colors.gray[800]};
`

const welcomeDialogBriefStyles = css`
  margin: 0;
  color: ${baseTheme.colors.gray[600]};
`

const welcomeDialogGoalsHeadingStyles = css`
  margin: 0.25rem 0 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${baseTheme.colors.gray[800]};
`

const welcomeDialogGoalsListStyles = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const welcomeDialogGoalItemStyles = css`
  position: relative;
  padding-left: 1.5rem;
  color: ${baseTheme.colors.gray[700]};

  &::before {
    content: "✓";
    position: absolute;
    left: 0;
    top: 0;
    color: ${baseTheme.colors.green[600]};
    font-weight: 700;
  }
`

const welcomeDialogHintStyles = css`
  margin: 0;
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[500]};
`

type StageBriefTranslationKey =
  | "course-plans-phase-brief-analysis"
  | "course-plans-phase-brief-design"
  | "course-plans-phase-brief-development"
  | "course-plans-phase-brief-implementation"
  | "course-plans-phase-brief-evaluation"

const STAGE_BRIEF_KEYS = {
  Analysis: "course-plans-phase-brief-analysis",
  Design: "course-plans-phase-brief-design",
  Development: "course-plans-phase-brief-development",
  Implementation: "course-plans-phase-brief-implementation",
  Evaluation: "course-plans-phase-brief-evaluation",
} satisfies Record<CourseDesignerStage, StageBriefTranslationKey>

function daysBetween(from: string, to: string): number {
  const a = new Date(from)
  const b = new Date(to)
  const diff = b.getTime() - a.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** Returns localized key-goal bullet labels for the given stage, or [] when none. */
function buildStageDescriptionItems(stage: CourseDesignerStage | null, t: TFunction): string[] {
  switch (stage) {
    case "Analysis":
      return [
        t("course-plans-stage-description-analysis-1"),
        t("course-plans-stage-description-analysis-2"),
        t("course-plans-stage-description-analysis-3"),
        t("course-plans-stage-description-analysis-4"),
        t("course-plans-stage-description-analysis-5"),
        t("course-plans-stage-description-analysis-6"),
      ]
    case "Design":
      return [
        t("course-plans-stage-description-design-1"),
        t("course-plans-stage-description-design-2"),
        t("course-plans-stage-description-design-3"),
        t("course-plans-stage-description-design-4"),
        t("course-plans-stage-description-design-5"),
        t("course-plans-stage-description-design-6"),
      ]
    case "Development":
      return [
        t("course-plans-stage-description-development-1"),
        t("course-plans-stage-description-development-2"),
      ]
    case "Implementation":
      return [
        t("course-plans-stage-description-implementation-1"),
        t("course-plans-stage-description-implementation-2"),
        t("course-plans-stage-description-implementation-3"),
      ]
    case "Evaluation":
      return [
        t("course-plans-stage-description-evaluation-1"),
        t("course-plans-stage-description-evaluation-2"),
        t("course-plans-stage-description-evaluation-3"),
      ]
    default:
      return []
  }
}

/* oxlint-disable i18next/no-literal-string -- internal state discriminants, not user-facing copy */
type StageRelation = "current" | "past" | "future" | "noActive" | "none"

/** Computes the relation of the selected stage to the active stage for messaging context. */
function computeStageRelation(
  selected: CourseDesignerStage | null,
  active: CourseDesignerStage | null,
): StageRelation {
  if (!selected) {
    return "none"
  }
  if (!active) {
    return "noActive"
  }
  if (selected === active) {
    return "current"
  }
  const selectedIndex = SCHEDULE_STAGE_ORDER.indexOf(selected)
  const activeIndex = SCHEDULE_STAGE_ORDER.indexOf(active)
  if (selectedIndex < 0 || activeIndex < 0) {
    return "none"
  }
  return selectedIndex < activeIndex ? "past" : "future"
}
/* oxlint-enable i18next/no-literal-string */

function CoursePlanWorkspacePage() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ""
  const requestedStageSlug = useSearchParams().get("stage")
  const invalidatePlan = useInvalidatePlan(planId)
  const { alert: showDialogAlert, confirm } = useDialog()
  const planQuery = useQuery(
    getCourseDesignerPlanOptions({
      path: {
        plan_id: planId,
      },
    }),
  )

  const extendMutation = useToastMutationOptions(
    extendCourseDesignerStageMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void invalidatePlan()
      },
    },
  )

  const advanceMutation = useToastMutationOptions(
    advanceCourseDesignerStageMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        void invalidatePlan()
      },
    },
  )

  const stageLabel = useCallback((stage: CourseDesignerStage) => translateStageLabel(stage, t), [t])

  const {
    isOverviewOpen,
    setIsOverviewOpen,
    viewedTab,
    viewedStage,
    setWorkspaceDirty,
    handleSelectedTabChange,
    handleAdvanceStage,
  } = useCoursePlanWorkspacePageState({
    planData: planQuery.data,
    requestedStageSlug,
    t,
    stageLabel,
    buildStageDescriptionItems,
    welcomeDialogBodyStyles,
    welcomeDialogIntroStyles,
    welcomeDialogBriefStyles,
    welcomeDialogGoalsHeadingStyles,
    welcomeDialogGoalsListStyles,
    welcomeDialogGoalItemStyles,
    welcomeDialogHintStyles,
    showDialogAlert,
    confirmDiscardUnsavedChanges: (message) => confirm({ message, isDestructive: true }),
    advanceStage: () => advanceMutation.mutateAsync({ path: { plan_id: planId } }),
  })

  return (
    <BreakFromCentered sidebar={false}>
      <div className={pageRootStyles}>
        <div className={workspaceShellStyles}>
          <QueryResult query={planQuery}>
            {({ plan, stages, section_statuses }) => {
              const currentStage = plan.active_stage ?? null
              const currentStageData = currentStage
                ? stages.find((s) => s.stage === currentStage)
                : null

              const viewedStageData =
                viewedStage !== null
                  ? (stages.find((stage) => stage.stage === viewedStage) ?? null)
                  : null

              const today = new Date().toISOString().slice(0, 10)
              let timeRemainingText: string | null = null
              let timeRemainingShort: string | null = null
              if (currentStageData) {
                const days = daysBetween(today, currentStageData.planned_ends_on)
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

              const lastEditedText = plan.updated_at
                ? t("course-plans-last-edited", {
                    time: dateToString(plan.updated_at),
                  })
                : null

              const currentPhaseEndDateFormatted =
                currentStageData?.planned_ends_on !== undefined
                  ? formatPlanMonthYear(currentStageData.planned_ends_on, i18n.language)
                  : null

              const activeStageTaskCompleted =
                currentStageData?.tasks !== undefined
                  ? currentStageData.tasks.filter((task) => task.is_completed).length
                  : 0
              const activeStageTaskTotal =
                currentStageData?.tasks !== undefined ? currentStageData.tasks.length : 0
              const currentStageIndex = currentStage
                ? SCHEDULE_STAGE_ORDER.indexOf(currentStage)
                : -1
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
                viewedStageData && viewedStage ? (
                  <WorkspaceStageSection
                    key={viewedStageData.id}
                    planId={planId}
                    stage={viewedStageData}
                    stageLabel={stageLabel(viewedStage)}
                    isActive={viewedStage === currentStage}
                    showStageTitle={false}
                    isReadOnly={plan.status === "Archived"}
                    onInvalidate={() => void invalidatePlan()}
                  />
                ) : null

              const stageDescriptionItems = buildStageDescriptionItems(viewedStage, t)
              const stageRelation = computeStageRelation(viewedStage, currentStage ?? null)
              const activeStageNameForCopy = currentStage ? stageLabel(currentStage) : ""
              const viewedStageNameForCopy = viewedStage ? stageLabel(viewedStage) : ""

              const keyGoalsContent =
                viewedStage && stageDescriptionItems.length > 0
                  ? stageDescriptionItems.map((line, index) => (
                      <li key={`${viewedStage}-${index}`} className={keyGoalItemStyles}>
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
                <SectionStatusProvider planId={planId} sectionStatuses={section_statuses}>
                  <PlanOverviewPanel
                    isOpen={isOverviewOpen}
                    onClose={() => setIsOverviewOpen(false)}
                    planName={plan.name ?? t("course-plans-untitled-plan")}
                    stages={stages}
                    activeStage={currentStage ?? null}
                    stageLabel={stageLabel}
                    canActOnCurrentStage={Boolean(canAct)}
                    onExtendCurrentStage={(months) =>
                      currentStage &&
                      extendMutation.mutate({
                        body: { months },
                        path: {
                          plan_id: planId,
                          stage: currentStage.toLowerCase(),
                        },
                      })
                    }
                    onAdvanceStage={() => {
                      void handleAdvanceStage()
                    }}
                    isExtendPending={extendMutation.isPending}
                    isAdvancePending={advanceMutation.isPending}
                    timeRemainingText={timeRemainingText}
                    timeRemainingShort={timeRemainingShort}
                    currentPhaseEndDateFormatted={currentPhaseEndDateFormatted}
                    activeStageTaskCompleted={activeStageTaskCompleted}
                    activeStageTaskTotal={activeStageTaskTotal}
                    nextStageLabel={nextStageLabel}
                  />

                  <div className={headerRowStyles}>
                    <div className={headerBlockStyles}>
                      <h1 className={titleStyles}>
                        {plan.name ?? t("course-plans-untitled-plan")}
                      </h1>
                      {lastEditedText && <p className={metadataRowStyles}>{lastEditedText}</p>}
                    </div>
                    <Link
                      href={manageCoursePlanPermissionsRoute(planId)}
                      className={manageMembersLinkStyles}
                    >
                      {t("course-plans-manage-members")}
                    </Link>
                  </div>

                  <StageTimelineTabStrip
                    stages={stages}
                    activeStage={currentStage ?? null}
                    selectedTab={viewedTab}
                    onSelectedTabChange={handleSelectedTabChange}
                    stageLabel={stageLabel}
                    onOpenOverview={() => setIsOverviewOpen(true)}
                    currentStageLabel={currentStage ? stageLabel(currentStage) : null}
                    panelClassName={
                      viewedTab === MOOC_DESIGN_TAB ? overviewGridStyles : workspaceGridStyles
                    }
                  >
                    {viewedTab === MOOC_DESIGN_TAB ? (
                      <>
                        <div>
                          <h2 className={currentStageTitleStyles}>
                            {t("course-plans-mooc-design-tab")}
                          </h2>
                          <MoocDesignOverview
                            planId={planId}
                            greatMoocVision={plan.great_mooc_vision}
                            isReadOnly={plan.status === "Archived"}
                          />
                        </div>
                        <CoursePlanAssistantPanel className={chatbotPanelStyles} />
                      </>
                    ) : (
                      <>
                        <div className={headerAreaStyles}>
                          <h2 className={currentStageTitleStyles}>
                            {viewedStage
                              ? stageLabel(viewedStage)
                              : t("course-plans-instructions-heading")}
                          </h2>
                          {stageRelation === "current" && (
                            <ActiveStageDeadlineCard
                              planId={planId}
                              stageLabel={stageLabel}
                              onCompleteStage={() => void handleAdvanceStage()}
                              isCompletePending={advanceMutation.isPending}
                              onExtendActiveStage={(months) =>
                                currentStage &&
                                extendMutation.mutate({
                                  body: { months },
                                  path: { plan_id: planId, stage: currentStage.toLowerCase() },
                                })
                              }
                              isExtendPending={extendMutation.isPending}
                            />
                          )}
                          {stageRelation === "past" && (
                            <aside
                              className={stageContextNoticeStyles}
                              aria-label={t("course-plans-stage-context-aria-label")}
                            >
                              <p className={stageContextEyebrowStyles}>
                                {t("course-plans-stage-context-past-eyebrow")}
                              </p>
                              <p className={stageContextTitleStyles}>
                                {t("course-plans-stage-context-past-title", {
                                  selectedStage: viewedStageNameForCopy,
                                })}
                              </p>
                              <p className={stageContextBodyStyles}>
                                {t("course-plans-stage-context-past-body", {
                                  activeStage: activeStageNameForCopy,
                                })}
                              </p>
                              {currentStage && (
                                <div className={stageContextActionRowStyles}>
                                  <Button
                                    variant="tertiary"
                                    size="small"
                                    onClick={() => handleSelectedTabChange(currentStage)}
                                  >
                                    {t("course-plans-stage-context-go-to-active", {
                                      activeStage: activeStageNameForCopy,
                                    })}
                                  </Button>
                                </div>
                              )}
                            </aside>
                          )}
                          {stageRelation === "future" && (
                            <aside
                              className={`${stageContextNoticeStyles} ${stageContextNoticeFutureStyles}`}
                              aria-label={t("course-plans-stage-context-aria-label")}
                            >
                              <p className={stageContextEyebrowStyles}>
                                {t("course-plans-stage-context-future-eyebrow")}
                              </p>
                              <p className={stageContextTitleStyles}>
                                {t("course-plans-stage-context-future-title", {
                                  selectedStage: viewedStageNameForCopy,
                                })}
                              </p>
                              <p className={stageContextBodyStyles}>
                                {t("course-plans-stage-context-future-body", {
                                  activeStage: activeStageNameForCopy,
                                })}
                              </p>
                              {currentStage && (
                                <div className={stageContextActionRowStyles}>
                                  <Button
                                    variant="tertiary"
                                    size="small"
                                    onClick={() => handleSelectedTabChange(currentStage)}
                                  >
                                    {t("course-plans-stage-context-go-to-active", {
                                      activeStage: activeStageNameForCopy,
                                    })}
                                  </Button>
                                </div>
                              )}
                            </aside>
                          )}
                        </div>

                        <section
                          className={`${cardStyles} ${instructionsAreaStyles}`}
                          aria-label={t("course-plans-instructions-aria-label")}
                        >
                          <h3 className={instructionsSectionTitleStyles}>
                            {t("course-plans-instructions-heading")}
                          </h3>
                          <p className={aboutHeadingStyles}>{t("course-plans-about-this-phase")}</p>
                          <p className={aboutTextStyles}>
                            {viewedStage
                              ? t(STAGE_BRIEF_KEYS[viewedStage])
                              : t("course-plans-instructions-placeholder")}
                          </p>
                          <p className={keyGoalsHeadingStyles}>{t("course-plans-key-goals")}</p>
                          <ul className={keyGoalsListStyles}>{keyGoalsContent}</ul>
                        </section>

                        <section
                          className={`${cardStyles} ${tasksAreaStyles} ${tasksCardStyles}`}
                          aria-label={t("course-plans-tasks-aria-label")}
                        >
                          <h3 className={sectionTitleStyles}>{t("course-plans-tasks-heading")}</h3>
                          {currentStageSection ?? (
                            <p className={emptyStateStyles}>{t("course-plans-no-active-stage")}</p>
                          )}
                        </section>

                        <section
                          className={`${cardStyles} ${workspaceAreaStyles} ${workspaceCardStyles}`}
                          aria-label={t("course-plans-workspace-aria-label")}
                        >
                          <h3 className={sectionTitleStyles}>
                            {t("course-plans-workspace-heading")}
                          </h3>
                          <p className={aboutTextStyles}>
                            {viewedStage === "Analysis" || viewedStage === "Design"
                              ? t("course-plans-workspace-description")
                              : t("course-plans-workspace-description-other-stages")}
                          </p>
                          {viewedStage ? (
                            <StageWorkspaceContent
                              key={viewedStage}
                              plan={plan}
                              stage={viewedStage}
                              stages={stages}
                              onDirtyChange={setWorkspaceDirty}
                            />
                          ) : null}
                        </section>

                        <CoursePlanAssistantPanel
                          className={cx(chatbotAreaStyles, chatbotPanelStyles)}
                        />
                      </>
                    )}
                  </StageTimelineTabStrip>
                </SectionStatusProvider>
              )
            }}
          </QueryResult>
        </div>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanWorkspacePage))
