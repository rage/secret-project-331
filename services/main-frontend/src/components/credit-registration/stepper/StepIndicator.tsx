"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { CheckIcon } from "@/shared-module/components/components/primitives/CheckIcon"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { srOnlyCss } from "./stepperStyles"
import type { Step } from "./stepperView"

const NARROW = "@media (max-width: 32rem)"

const countCss = css`
  margin: 0 0 var(--space-3);
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 600;
`

const trackCss = css`
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const stepCss = css`
  flex: 1 1 0;
  min-width: 0;
`

const currentStepCss = css`
  ${NARROW} {
    flex-grow: 2.4;
  }
`

const segmentCss = css`
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-3);
  background: none;
  font: inherit;
  font-size: 15px;
  text-align: left;

  ${NARROW} {
    gap: 6px;
    justify-content: center;
    padding: 0 8px;
    font-size: 13px;
  }
`

const doneSegmentCss = css`
  background: var(--color-green-75);
  color: var(--color-green-700);
  font-weight: 500;
`

const clickableSegmentCss = css`
  cursor: pointer;

  &:hover {
    border-color: var(--color-green-600);
  }
`

const currentSegmentCss = css`
  background: var(--color-green-600);
  box-shadow: 0 2px 8px rgba(31, 105, 100, 0.25);
  color: var(--color-clear-50);
  font-size: 16px;
  font-weight: 700;

  ${NARROW} {
    font-size: 14px;
  }
`

const upcomingSegmentCss = css`
  border: 1px dashed var(--color-gray-200);
  color: var(--color-gray-500);
  font-weight: 500;
`

const markCss = css`
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  text-box: trim-both cap alphabetic;
`

const doneMarkCss = css`
  background: var(--color-green-600);
  color: var(--color-clear-50);
  font-size: 14px;
`

const currentMarkCss = css`
  background: var(--color-clear-50);
  color: var(--color-green-600);
`

const upcomingMarkCss = css`
  border: 1.5px solid var(--color-gray-300);
  color: var(--color-gray-500);
`

const labelCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/** On a phone only the current step has room to say its name. */
const labelHiddenWhenNarrowCss = css`
  ${NARROW} {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
`

export interface StepIndicatorProps {
  steps: readonly Step[]
  current: Step
  /** Opens an earlier step; `null` when the earlier steps are no longer the student's to revisit. */
  onGoTo: ((step: Step) => void) | null
}

/**
 * Which step the student is on, out of how many. The current step is the only filled segment, so
 * a glance finds it; finished ones carry a check and lead back.
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, current, onGoTo }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const currentIndex = steps.indexOf(current)
  const labelOf = (step: Step): string => {
    switch (step) {
      case "questions":
        return t("credit-registration-step-label-questions")
      case "enrolment":
        return t("credit-registration-step-label-enrolment")
      case "linking":
        return t("credit-registration-step-label-linking")
    }
  }

  return (
    <nav aria-label={t("credit-registration-steps-label")}>
      <p className={countCss}>
        {t("credit-registration-step-n-of-count", { n: currentIndex + 1, count: steps.length })}
      </p>
      <ol className={trackCss}>
        {steps.map((step, index) => {
          const label = labelOf(step)
          if (index < currentIndex) {
            const content = (
              <>
                <span className={cx(markCss, doneMarkCss)} aria-hidden="true">
                  <CheckIcon />
                </span>
                <span className={cx(labelCss, labelHiddenWhenNarrowCss)} aria-hidden="true">
                  {label}
                </span>
                <span className={srOnlyCss}>
                  {t("credit-registration-step-done", { step: label })}
                </span>
              </>
            )
            return (
              <li key={step} className={stepCss}>
                {onGoTo ? (
                  <button
                    type="button"
                    className={cx(segmentCss, doneSegmentCss, clickableSegmentCss)}
                    onClick={() => onGoTo(step)}
                  >
                    {content}
                  </button>
                ) : (
                  <span className={cx(segmentCss, doneSegmentCss)}>{content}</span>
                )}
              </li>
            )
          }
          const isCurrent = index === currentIndex
          return (
            <li
              key={step}
              className={cx(stepCss, isCurrent && currentStepCss)}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className={cx(segmentCss, isCurrent ? currentSegmentCss : upcomingSegmentCss)}>
                <span
                  className={cx(markCss, isCurrent ? currentMarkCss : upcomingMarkCss)}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {isCurrent ? (
                  <span className={labelCss}>{label}</span>
                ) : (
                  <>
                    <span className={cx(labelCss, labelHiddenWhenNarrowCss)} aria-hidden="true">
                      {label}
                    </span>
                    <span className={srOnlyCss}>
                      {t("credit-registration-step-upcoming", { step: label })}
                    </span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
