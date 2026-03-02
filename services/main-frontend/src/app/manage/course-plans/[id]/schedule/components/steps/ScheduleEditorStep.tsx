"use client"

import { css } from "@emotion/css"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { SCHEDULE_STAGE_COUNT } from "../../scheduleConstants"
import { StageCardViewModel } from "../../scheduleMappers"
import StageCard from "../StageCard"

import { CourseDesignerStage } from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"

const toolbarStyles = css`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
`

const stageListStyles = css`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const wizardNavStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
`

const validationErrorStyles = css`
  margin-top: 0.75rem;
  color: #8d2323;
  font-weight: 600;
`

interface ScheduleEditorStepProps {
  draftStageCount: number
  stageCards: Array<StageCardViewModel>
  stageLabel: (stage: CourseDesignerStage) => string
  validationError: string | null
  startsOnMonth: string
  reduceMotion: boolean
  isGeneratingSuggestion: boolean
  isSaving: boolean
  isFinalizing: boolean
  onResetSuggestion: () => void
  onAddMonth: (stage: CourseDesignerStage) => void
  onRemoveMonth: (stage: CourseDesignerStage) => void
  onBack: () => void
  onSave: () => void
  onFinalize: () => void
}

export default function ScheduleEditorStep({
  draftStageCount,
  stageCards,
  stageLabel,
  validationError,
  startsOnMonth,
  reduceMotion,
  isGeneratingSuggestion,
  isSaving,
  isFinalizing,
  onResetSuggestion,
  onAddMonth,
  onRemoveMonth,
  onBack,
  onSave,
  onFinalize,
}: ScheduleEditorStepProps) {
  const { t } = useTranslation()
  const [pulseStage, setPulseStage] = useState<CourseDesignerStage | null>(null)

  const isCompleteSchedule = stageCards.length === SCHEDULE_STAGE_COUNT
  const submitDisabled = !isCompleteSchedule || validationError !== null || isSaving || isFinalizing

  return (
    <>
      <h2>{t("course-plans-wizard-step-schedule")}</h2>

      <div className={toolbarStyles}>
        <Button
          variant="secondary"
          size="medium"
          onClick={onResetSuggestion}
          disabled={isGeneratingSuggestion || !startsOnMonth.trim()}
        >
          {t("course-plans-reset-suggestion")}
        </Button>
      </div>

      {draftStageCount === 0 && <p>{t("course-plans-schedule-empty-help")}</p>}

      {isCompleteSchedule && (
        <LayoutGroup>
          <div className={stageListStyles}>
            {stageCards.map((card) => {
              // eslint-disable-next-line i18next/no-literal-string -- stable test id prefix
              const stageTestId = `course-plan-stage-${card.stage}`
              return (
                <StageCard
                  key={card.stage}
                  stage={card.stage}
                  title={stageLabel(card.stage)}
                  months={card.months}
                  canShrink={card.canShrink}
                  reduceMotion={reduceMotion}
                  isPulsing={pulseStage === card.stage}
                  onPulseComplete={() => {
                    if (pulseStage === card.stage) {
                      setPulseStage(null)
                    }
                  }}
                  onAddMonth={() => {
                    setPulseStage(card.stage)
                    onAddMonth(card.stage)
                  }}
                  onRemoveMonth={() => {
                    setPulseStage(card.stage)
                    onRemoveMonth(card.stage)
                  }}
                  testId={stageTestId}
                />
              )
            })}
          </div>
        </LayoutGroup>
      )}

      <AnimatePresence>
        {validationError && (
          <motion.div
            key="validation-error"
            layout={!reduceMotion}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 0.2,
                    // eslint-disable-next-line i18next/no-literal-string -- Motion ease value
                    ease: "easeOut",
                  }
            }
            className={validationErrorStyles}
          >
            {validationError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={wizardNavStyles}>
        <Button variant="secondary" size="medium" onClick={onBack}>
          {t("back")}
        </Button>
        <Button variant="primary" size="medium" disabled={submitDisabled} onClick={onSave}>
          {t("course-plans-save-schedule")}
        </Button>
        <Button variant="secondary" size="medium" disabled={submitDisabled} onClick={onFinalize}>
          {t("course-plans-finalize-schedule")}
        </Button>
      </div>
    </>
  )
}
