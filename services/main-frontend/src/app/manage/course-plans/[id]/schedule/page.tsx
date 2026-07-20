"use client"

import { css, cx } from "@emotion/css"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import { manageCoursePlanWorkspaceRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

import ScheduleWizardProgress from "./components/ScheduleWizardProgress"
import NameStep from "./components/steps/NameStep"
import ScheduleEditorStep from "./components/steps/ScheduleEditorStep"
import SetupStep from "./components/steps/SetupStep"
import useScheduleWizardController from "./hooks/useScheduleWizardController"
import type { ScheduleWizardStepId } from "./scheduleConstants"

const MOTION_PRESENCE_MODE_WAIT = "wait"
const MOTION_VARIANT_INITIAL = "initial"
const MOTION_VARIANT_ANIMATE = "animate"
const MOTION_VARIANT_EXIT = "exit"
const MOTION_STEP_TRANSITION = {
  type: "tween",
  duration: 0.25,
  ease: "easeOut",
} as const

const containerStyles = css`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
`

const titleStyles = css`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
`

const sectionStyles = css`
  background: white;
  border: 1px solid #d9dde4;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
`

const wizardStepCardStyles = css`
  background: white;
  border-radius: 16px;
  padding: 2rem 2.25rem;
  margin-bottom: 1rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 0 1px rgba(0, 0, 0, 0.04);
  border-left: 4px solid ${baseTheme.colors.green[500]};

  h2 {
    font-size: 1.35rem;
    font-weight: 700;
    color: ${baseTheme.colors.gray[800]};
    margin: 0 0 1.5rem 0;
    letter-spacing: -0.02em;
  }
`

function stepTransitionDirection(step: ScheduleWizardStepId): string {
  return step
}

function ScheduleWizardPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ""
  const controller = useScheduleWizardController(planId)
  const reduceMotion = !!useReducedMotion()

  const stageLabel = useCallback(
    (stage: CourseDesignerStage) => {
      switch (stage) {
        case "Analysis":
          return t("course-plans-stage-analysis")
        case "Design":
          return t("course-plans-stage-design")
        case "Development":
          return t("course-plans-stage-development")
        case "Implementation":
          return t("course-plans-stage-implementation")
        case "Evaluation":
          return t("course-plans-stage-evaluation")
      }
    },
    [t],
  )

  const validationError = useMemo(() => {
    const issue = controller.ui.validationIssue
    if (!issue) {
      return null
    }

    switch (issue.code) {
      case "stage_count":
        return t("course-plans-validation-stage-count")
      case "invalid_range":
        return t("course-plans-validation-stage-range", { stage: stageLabel(issue.stage) })
      case "non_contiguous":
        return t("course-plans-validation-contiguous")
    }
  }, [controller.ui.validationIssue, stageLabel, t])

  const stepTransition = reduceMotion ? { duration: 0 } : MOTION_STEP_TRANSITION

  const stepVariants = {
    initial: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { x: dir === 1 ? 40 : -40, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { x: dir === 1 ? -40 : 40, opacity: 0 },
  }

  return (
    <QueryResult query={controller.planQuery}>
      {() => (
        <div className={containerStyles}>
          <h1 className={titleStyles}>{t("course-plans-schedule-title")}</h1>

          <ScheduleWizardProgress step={controller.ui.step} />

          <AnimatePresence mode={MOTION_PRESENCE_MODE_WAIT} custom={controller.ui.wizardDirection}>
            <motion.div
              key={stepTransitionDirection(controller.ui.step)}
              custom={controller.ui.wizardDirection}
              variants={stepVariants}
              initial={MOTION_VARIANT_INITIAL}
              animate={MOTION_VARIANT_ANIMATE}
              exit={MOTION_VARIANT_EXIT}
              transition={stepTransition}
              className={cx(sectionStyles, wizardStepCardStyles)}
              layout={!reduceMotion}
            >
              {controller.ui.step === "name" && (
                <NameStep
                  planName={controller.ui.planName}
                  onPlanNameChange={controller.actions.setPlanName}
                  // oxlint-disable-next-line i18next/no-literal-string -- wizard step id
                  onContinue={() => controller.actions.goToStep("setup")}
                />
              )}

              {controller.ui.step === "setup" && (
                <SetupStep
                  courseSize={controller.ui.courseSize}
                  startsOnMonth={controller.ui.startsOnMonth}
                  isGeneratingSuggestion={controller.status.isGeneratingSuggestion}
                  onCourseSizeChange={controller.actions.setCourseSize}
                  onStartsOnMonthChange={controller.actions.setStartsOnMonth}
                  // oxlint-disable-next-line i18next/no-literal-string -- wizard step id
                  onBack={() => controller.actions.goToStep("name")}
                  onContinue={() => {
                    void controller.actions.generateSuggestion({ goToScheduleStep: true })
                  }}
                />
              )}

              {controller.ui.step === "schedule" && (
                <ScheduleEditorStep
                  draftStageCount={controller.ui.draftStageCount}
                  stageCards={controller.ui.stageCards}
                  stageLabel={stageLabel}
                  validationError={validationError}
                  startsOnMonth={controller.ui.startsOnMonth}
                  reduceMotion={reduceMotion}
                  isGeneratingSuggestion={controller.status.isGeneratingSuggestion}
                  isSaving={controller.status.isSaving}
                  isFinalizing={controller.status.isFinalizing}
                  onResetSuggestion={() => {
                    void controller.actions.generateSuggestion()
                  }}
                  onAddMonth={controller.actions.addMonth}
                  onRemoveMonth={controller.actions.removeMonth}
                  // oxlint-disable-next-line i18next/no-literal-string -- wizard step id
                  onBack={() => controller.actions.goToStep("setup")}
                  onFinalize={async () => {
                    const ok = await controller.actions.finalizeDraft()
                    if (ok) {
                      router.push(manageCoursePlanWorkspaceRoute(planId))
                    }
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(ScheduleWizardPage))
