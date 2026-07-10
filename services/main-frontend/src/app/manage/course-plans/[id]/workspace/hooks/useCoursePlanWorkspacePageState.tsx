"use client"

import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { CourseDesignerStage } from "@/generated/api/types.generated"

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

interface PlanQueryData {
  plan: { active_stage?: CourseDesignerStage | null }
  stages: { stage: CourseDesignerStage }[]
}

interface UseCoursePlanWorkspacePageStateOptions {
  planData: PlanQueryData | undefined
  t: TFunction
  stageLabel: (stage: CourseDesignerStage) => string
  buildStageDescriptionItems: (stage: CourseDesignerStage | null, t: TFunction) => string[]
  welcomeDialogBodyStyles: string
  welcomeDialogIntroStyles: string
  welcomeDialogBriefStyles: string
  welcomeDialogGoalsHeadingStyles: string
  welcomeDialogGoalsListStyles: string
  welcomeDialogGoalItemStyles: string
  welcomeDialogHintStyles: string
  showDialogAlert: (body: ReactNode, title: string) => Promise<void>
  advanceStage: () => Promise<{ plan: { active_stage?: CourseDesignerStage | null } }>
}

/** Workspace chrome state: overview panel, viewed stage, and analysis dirty tracking. */
export function useCoursePlanWorkspacePageState({
  planData,
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
  advanceStage,
}: UseCoursePlanWorkspacePageStateOptions) {
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [viewedStage, setViewedStage] = useState<CourseDesignerStage | null>(null)
  const [analysisWorkspaceDirty, setAnalysisWorkspaceDirty] = useState(false)
  const previousActiveStageRef = useRef<CourseDesignerStage | null>(null)
  const welcomedStageRef = useRef<string | null>(null)

  const handleSelectedStageChange = useCallback(
    (stage: CourseDesignerStage) => {
      if (analysisWorkspaceDirty && viewedStage === "Analysis" && stage !== viewedStage) {
        if (!window.confirm(t("course-plans-analysis-unsaved-confirm"))) {
          return
        }
      }
      setViewedStage(stage)
    },
    [analysisWorkspaceDirty, viewedStage, t],
  )

  const handleAdvanceStage = useCallback(async () => {
    const previousStage = planData?.plan.active_stage ?? null
    let result
    try {
      result = await advanceStage()
    } catch {
      return
    }

    setIsOverviewOpen(false)

    const nextStage = result.plan.active_stage ?? null
    // oxlint-disable-next-line i18next/no-literal-string -- internal sentinel value, not user-facing copy
    const transitionKey = nextStage ?? "completed"
    if (welcomedStageRef.current === transitionKey) {
      return
    }
    welcomedStageRef.current = transitionKey

    if (nextStage) {
      const goalItems = buildStageDescriptionItems(nextStage, t)
      const stageName = stageLabel(nextStage)
      const previousStageName = previousStage ? stageLabel(previousStage) : null
      const briefKey = STAGE_BRIEF_KEYS[nextStage]
      const dialogBody = (
        <div className={welcomeDialogBodyStyles}>
          <p className={welcomeDialogIntroStyles}>
            {previousStageName
              ? t("course-plans-welcome-dialog-intro", {
                  stage: stageName,
                  previousStage: previousStageName,
                })
              : t("course-plans-welcome-dialog-intro-no-previous", { stage: stageName })}
          </p>
          <p className={welcomeDialogBriefStyles}>{t(briefKey)}</p>
          {goalItems.length > 0 && (
            <>
              <p className={welcomeDialogGoalsHeadingStyles}>
                {t("course-plans-welcome-dialog-goals-heading")}
              </p>
              <ul className={welcomeDialogGoalsListStyles}>
                {goalItems.map((item, index) => (
                  <li key={`${nextStage}-goal-${index}`} className={welcomeDialogGoalItemStyles}>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={welcomeDialogHintStyles}>
            {t("course-plans-welcome-dialog-timeline-hint")}
          </p>
        </div>
      )
      await showDialogAlert(
        dialogBody,
        t("course-plans-welcome-dialog-title", { stage: stageName }),
      )
      return
    }

    const dialogBody = (
      <div className={welcomeDialogBodyStyles}>
        <p className={welcomeDialogIntroStyles}>{t("course-plans-welcome-dialog-final-intro")}</p>
        <p className={welcomeDialogBriefStyles}>{t("course-plans-welcome-dialog-final-body")}</p>
      </div>
    )
    await showDialogAlert(dialogBody, t("course-plans-welcome-dialog-final-title"))
  }, [
    advanceStage,
    buildStageDescriptionItems,
    planData?.plan.active_stage,
    showDialogAlert,
    stageLabel,
    t,
    welcomeDialogBodyStyles,
    welcomeDialogBriefStyles,
    welcomeDialogGoalItemStyles,
    welcomeDialogGoalsHeadingStyles,
    welcomeDialogGoalsListStyles,
    welcomeDialogHintStyles,
    welcomeDialogIntroStyles,
  ])

  useEffect(() => {
    if (viewedStage !== "Analysis") {
      setAnalysisWorkspaceDirty(false)
    }
  }, [viewedStage])

  useEffect(() => {
    if (!planData) {
      return
    }

    const nextActiveStage = planData.plan.active_stage ?? null
    const firstAvailableStage = planData.stages[0]?.stage ?? null
    const hasViewedStage =
      viewedStage != null && planData.stages.some((stage) => stage.stage === viewedStage)

    if (!hasViewedStage) {
      setViewedStage(nextActiveStage ?? firstAvailableStage)
      previousActiveStageRef.current = nextActiveStage
      return
    }

    if (
      previousActiveStageRef.current &&
      nextActiveStage &&
      nextActiveStage !== previousActiveStageRef.current &&
      viewedStage === previousActiveStageRef.current
    ) {
      setViewedStage(nextActiveStage)
    }

    previousActiveStageRef.current = nextActiveStage
  }, [planData, viewedStage])

  return {
    isOverviewOpen,
    setIsOverviewOpen,
    viewedStage,
    analysisWorkspaceDirty,
    setAnalysisWorkspaceDirty,
    handleSelectedStageChange,
    handleAdvanceStage,
  }
}
