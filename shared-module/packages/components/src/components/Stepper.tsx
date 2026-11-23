"use client"

import { css, cx } from "@emotion/css"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { CheckIcon } from "./primitives/CheckIcon"

export type StepState = "done" | "current" | "upcoming"

export interface StepperStep {
  label: string
  /** Overrides the state derived from `currentStep`, e.g. to mark a later step as done. */
  state?: StepState
}

export interface StepperProps {
  steps: readonly StepperStep[]
  /** Zero-based index of the current step. Earlier steps are done, later ones upcoming. */
  currentStep: number
  /** Accessible name of the list. */
  "aria-label"?: string | undefined
  className?: string
  "data-testid"?: string | undefined
}

const DONE = "done" as const
const CURRENT = "current" as const
const UPCOMING = "upcoming" as const

const CIRCLE_SIZE = "28px"

const listCss = css`
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
`

const itemCss = css`
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  padding: 0 var(--space-2);
  font-size: var(--font-size-0);
  line-height: 1.35;
  text-align: center;
  overflow-wrap: anywhere;
  color: var(--color-gray-500);

  @media (min-width: 600px) {
    font-size: var(--font-size-1);
  }

  /* Connector from the previous circle's edge to this one's. */
  &:not(:first-child)::before {
    content: "";
    position: absolute;
    top: calc(${CIRCLE_SIZE} / 2 - 1px);
    left: calc(-50% + ${CIRCLE_SIZE} / 2 + var(--space-3));
    right: calc(50% + ${CIRCLE_SIZE} / 2 + var(--space-3));
    height: 2px;
    border-radius: 1px;
    background: var(--color-gray-100);
  }
`

const circleCss = css`
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: ${CIRCLE_SIZE};
  height: ${CIRCLE_SIZE};
  border: 2px solid var(--color-gray-200);
  border-radius: 50%;
  background: #fff;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const reachedItemCss = css`
  &:not(:first-child)::before {
    background: var(--color-green-600);
  }
`

const doneItemCss = css`
  color: var(--color-gray-700);
`

const doneCircleCss = css`
  border-color: var(--color-green-600);
  background: var(--color-green-600);
  color: #fff;
  font-size: 14px;
`

const currentItemCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
`

const currentCircleCss = css`
  border-color: var(--color-green-600);
  color: var(--color-green-700);
  box-shadow: 0 0 0 3px var(--color-green-100);
`

function resolveStepState(step: StepperStep, index: number, currentStep: number): StepState {
  if (step.state) {
    return step.state
  }
  if (index < currentStep) {
    return DONE
  }
  return index === currentStep ? CURRENT : UPCOMING
}

/**
 * Numbered progress through a fixed sequence of steps: done steps show a check, the current one
 * is outlined and bold. Display only; the page decides when to move between steps.
 */
export function Stepper({
  steps,
  currentStep,
  "aria-label": ariaLabel,
  className,
  "data-testid": dataTestId,
}: StepperProps) {
  const { t } = useTranslation("shared-module")

  return (
    <ol aria-label={ariaLabel} className={cx(listCss, className)} data-testid={dataTestId}>
      {steps.map((step, index) => {
        const state = resolveStepState(step, index, currentStep)
        const isDone = state === DONE
        const isCurrent = state === CURRENT
        return (
          <li
            key={index}
            aria-current={isCurrent ? "step" : undefined}
            className={cx(
              itemCss,
              (isDone || isCurrent) && reachedItemCss,
              isDone && doneItemCss,
              isCurrent && currentItemCss,
            )}
          >
            <span
              aria-hidden="true"
              className={cx(circleCss, isDone && doneCircleCss, isCurrent && currentCircleCss)}
            >
              {isDone ? <CheckIcon /> : index + 1}
            </span>
            <span>
              {step.label}
              {isDone && <VisuallyHidden> ({t("stepper.completed")})</VisuallyHidden>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
