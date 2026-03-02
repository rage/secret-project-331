"use client"

import { css } from "@emotion/css"
import { motion, useReducedMotion } from "motion/react"
import { useProgressBar } from "react-aria"
import { useTranslation } from "react-i18next"

import { SCHEDULE_WIZARD_STEPS, ScheduleWizardStepId } from "../scheduleConstants"

import { baseTheme } from "@/shared-module/common/styles"

const progressTextStyles = css`
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[500]};
  margin: 0 0 2rem 0;
`

const wizardStepsStripStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  position: relative;
  gap: 0.5rem;
`

const wizardStepsConnectorStyles = css`
  position: absolute;
  top: 19px;
  left: 0;
  right: 0;
  height: 2px;
  background: ${baseTheme.colors.gray[200]};
  z-index: 0;
  pointer-events: none;
`

const wizardProgressFillBaseStyles = css`
  position: absolute;
  top: 19px;
  left: 0;
  width: 100%;
  height: 2px;
  background: ${baseTheme.colors.green[500]};
  z-index: 0;
  pointer-events: none;
  transform-origin: left;
`

const wizardStepPillStyles = (isActive: boolean, isCompleted: boolean) => css`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;

  .wizard-step-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.95rem;
    transition:
      background-color 0.2s,
      color 0.2s,
      border-color 0.2s,
      box-shadow 0.2s;
    border: 2px solid ${baseTheme.colors.gray[300]};
    background: white;
    color: ${baseTheme.colors.gray[500]};
  }

  ${isCompleted &&
  css`
    .wizard-step-circle {
      background: ${baseTheme.colors.green[500]};
      border-color: ${baseTheme.colors.green[600]};
      color: white;
    }
  `}

  ${isActive &&
  css`
    .wizard-step-circle {
      background: ${baseTheme.colors.green[600]};
      border-color: ${baseTheme.colors.green[700]};
      color: white;
      box-shadow: 0 0 0 4px ${baseTheme.colors.green[100]};
    }
  `}

  .wizard-step-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: ${isActive ? baseTheme.colors.green[700] : baseTheme.colors.gray[500]};
    text-align: center;
    line-height: 1.2;
  }
`

const srOnlyStyles = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

interface ScheduleWizardProgressProps {
  step: ScheduleWizardStepId
}

export default function ScheduleWizardProgress({ step }: ScheduleWizardProgressProps) {
  const { t } = useTranslation()
  const reduceMotion = !!useReducedMotion()

  const currentStepIndex = SCHEDULE_WIZARD_STEPS.indexOf(step)
  const progressPercentage =
    (currentStepIndex / Math.max(1, SCHEDULE_WIZARD_STEPS.length - 1)) * 100

  const progressBar = useProgressBar({
    label: t("course-plans-wizard-progress-label"),
    value: currentStepIndex + 1,
    minValue: 1,
    maxValue: SCHEDULE_WIZARD_STEPS.length,
    // eslint-disable-next-line i18next/no-literal-string -- step counter, not user-facing copy
    valueLabel: `Step ${currentStepIndex + 1} of ${SCHEDULE_WIZARD_STEPS.length}`,
  })

  return (
    <>
      <p className={progressTextStyles}>
        {t("course-plans-wizard-progress-label")}: {progressBar.progressBarProps["aria-valuetext"]}
      </p>

      <div className={wizardStepsStripStyles}>
        <div className={wizardStepsConnectorStyles} aria-hidden />
        <motion.div
          className={wizardProgressFillBaseStyles}
          aria-hidden
          initial={false}
          animate={{ scaleX: progressPercentage / 100 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  type: "tween",
                  duration: 0.35,
                  // eslint-disable-next-line i18next/no-literal-string -- Motion ease value
                  ease: "easeOut",
                }
          }
        />

        {SCHEDULE_WIZARD_STEPS.map((stepId, index) => {
          const isActive = index === currentStepIndex
          const isCompleted = index < currentStepIndex
          let label = ""
          switch (stepId) {
            case "name":
              label = t("course-plans-wizard-step-name")
              break
            case "setup":
              label = t("course-plans-wizard-step-size-and-date")
              break
            case "schedule":
              label = t("course-plans-wizard-step-schedule")
              break
          }
          // eslint-disable-next-line i18next/no-literal-string -- step circle shows checkmark/step number
          const stepMarker = isCompleted ? "✓" : String(index + 1)
          return (
            <div key={stepId} className={wizardStepPillStyles(isActive, isCompleted)}>
              <motion.div
                className="wizard-step-circle"
                aria-hidden
                animate={
                  reduceMotion
                    ? {}
                    : isActive
                      ? { scale: [1, 1.05, 1] }
                      : isCompleted
                        ? { scale: [1, 1.12, 1] }
                        : {}
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        type: "tween",
                        duration: 0.25,
                        // eslint-disable-next-line i18next/no-literal-string -- Motion ease value
                        ease: "easeOut",
                      }
                }
              >
                {stepMarker}
              </motion.div>
              <span className="wizard-step-label">{label}</span>
            </div>
          )
        })}
      </div>

      <div {...progressBar.progressBarProps} className={srOnlyStyles}>
        {t("course-plans-wizard-progress-label")}: {progressBar.progressBarProps["aria-valuetext"]}
      </div>
    </>
  )
}
