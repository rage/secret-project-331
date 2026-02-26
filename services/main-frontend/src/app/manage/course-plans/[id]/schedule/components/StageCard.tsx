"use client"

import { css } from "@emotion/css"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { StageMonth } from "../scheduleMappers"

import MonthBlock from "./MonthBlock"

import { CourseDesignerStage } from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import { baseTheme } from "@/shared-module/common/styles"

const stageCardStyles = css`
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 14px;
  background: #fbfcfd;
  padding: 1rem;
`

const stageRowStyles = css`
  display: flex;
  gap: 1rem;
  width: 100%;

  @media (max-width: 900px) {
    flex-direction: column;
  }
`

const stageMonthBlocksStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  flex: 0 0 auto;
`

const stageCardRightStyles = css`
  min-width: 240px;
  flex: 1 1 38%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const stageTitleStyles = css`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
`

const stageDescriptionPlaceholderStyles = css`
  margin: 0;
  font-size: 0.88rem;
  color: ${baseTheme.colors.gray[500]};
`

const stageDescriptionListStyles = css`
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.88rem;
  color: ${baseTheme.colors.gray[500]};
`

const stageDescriptionItemStyles = css`
  margin: 0.1rem 0;
`

const stageCardActionsStyles = css`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
`

interface StageCardProps {
  stage: CourseDesignerStage
  title: string
  months: Array<StageMonth>
  canShrink: boolean
  reduceMotion: boolean
  isPulsing: boolean
  onPulseComplete: () => void
  onAddMonth: () => void
  onRemoveMonth: () => void
  testId?: string
}

export default function StageCard({
  stage,
  title,
  months,
  canShrink,
  reduceMotion,
  isPulsing,
  onPulseComplete,
  onAddMonth,
  onRemoveMonth,
  testId,
}: StageCardProps) {
  const { t } = useTranslation()

  const descriptionLines =
    stage === "Analysis"
      ? [
          t("course-plans-stage-description-analysis-1"),
          t("course-plans-stage-description-analysis-2"),
          t("course-plans-stage-description-analysis-3"),
          t("course-plans-stage-description-analysis-4"),
          t("course-plans-stage-description-analysis-5"),
        ]
      : stage === "Design"
        ? [
            t("course-plans-stage-description-design-1"),
            t("course-plans-stage-description-design-2"),
            t("course-plans-stage-description-design-3"),
            t("course-plans-stage-description-design-4"),
            t("course-plans-stage-description-design-5"),
          ]
        : stage === "Development"
          ? [
              t("course-plans-stage-description-development-1"),
              t("course-plans-stage-description-development-2"),
            ]
          : stage === "Implementation"
            ? [
                t("course-plans-stage-description-implementation-1"),
                t("course-plans-stage-description-implementation-2"),
                t("course-plans-stage-description-implementation-3"),
              ]
            : stage === "Evaluation"
              ? [
                  t("course-plans-stage-description-evaluation-1"),
                  t("course-plans-stage-description-evaluation-2"),
                ]
              : []

  return (
    <motion.div
      layout
      className={stageCardStyles}
      data-testid={testId}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        className={stageRowStyles}
        animate={isPulsing ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={
          isPulsing
            ? reduceMotion
              ? { duration: 0 }
              : {
                  type: "tween",
                  duration: 0.18,
                  // eslint-disable-next-line i18next/no-literal-string -- Motion ease value
                  ease: "easeOut",
                }
            : reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 30 }
        }
        onAnimationComplete={() => {
          if (isPulsing) {
            onPulseComplete()
          }
        }}
      >
        <div className={stageMonthBlocksStyles}>
          {/* eslint-disable-next-line i18next/no-literal-string -- Motion mode name */}
          <AnimatePresence initial={false} mode="popLayout">
            {months.map((month) => {
              // eslint-disable-next-line i18next/no-literal-string -- stable layout animation id prefix
              const monthLayoutId = `month-${month.id}`
              return (
                <MonthBlock
                  key={month.id}
                  month={month}
                  reduceMotion={reduceMotion}
                  layoutId={monthLayoutId}
                />
              )
            })}
          </AnimatePresence>
        </div>

        <div className={stageCardRightStyles}>
          <h3 className={stageTitleStyles}>{title}</h3>
          {descriptionLines.length > 0 ? (
            <ul className={stageDescriptionListStyles}>
              {descriptionLines.map((line) => (
                <li key={line} className={stageDescriptionItemStyles}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className={stageDescriptionPlaceholderStyles}>
              {t("course-plans-stage-description-placeholder")}
            </p>
          )}

          <div className={stageCardActionsStyles}>
            <Button variant="secondary" size="small" onClick={onAddMonth}>
              {t("course-plans-add-one-month")}
            </Button>
            <Button variant="secondary" size="small" onClick={onRemoveMonth} disabled={!canShrink}>
              {t("course-plans-remove-one-month")}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
