"use client"

import { css, cx } from "@emotion/css"
import React from "react"

import { srOnlyCss } from "../primitives/buttonStyles"
import {
  registrationStatusColorCss,
  registrationStatusIcon,
  type RegistrationStatusState,
} from "./registrationStatusState"

export interface RegistrationStatusStep {
  label: React.ReactNode
  state: RegistrationStatusState
  /** Read out after the label, since the marker is only a shape and a colour. */
  stateLabel: string
}

export interface RegistrationStatusStepperProps {
  steps: RegistrationStatusStep[]
  "aria-label": string
  className?: string
}

const rootCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) 0;
  margin: 0;
  padding: 0;
  list-style: none;
`

const stepCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
`

const markerCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
`

// A ring rather than nothing, so an unreached step still holds its place in the sequence.
const upcomingMarkerCss = css`
  width: 10px;
  height: 10px;
  border: 2px solid var(--color-gray-300);
  border-radius: 999px;
`

const labelCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const currentLabelCss = css`
  font-weight: 600;
  color: var(--color-gray-800);
`

const connectorCss = css`
  flex: 1 1 var(--space-4);
  min-width: var(--space-4);
  height: 1px;
  margin: 0 var(--space-3);
  background: var(--color-gray-200);
`

export const RegistrationStatusStepper: React.FC<RegistrationStatusStepperProps> = ({
  steps,
  "aria-label": ariaLabel,
  className,
}) => (
  <ol className={cx(rootCss, className)} aria-label={ariaLabel}>
    {steps.map((step, index) => {
      const Icon = registrationStatusIcon[step.state]
      return (
        <li
          key={index}
          className={stepCss}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span
            className={cx(markerCss, registrationStatusColorCss[step.state])}
            aria-hidden="true"
          >
            {Icon ? <Icon size={16} /> : <span className={upcomingMarkerCss} />}
          </span>
          <span className={cx(labelCss, step.state === "current" ? currentLabelCss : undefined)}>
            {step.label}
          </span>
          <span className={srOnlyCss}>{step.stateLabel}</span>
          {index < steps.length - 1 ? <span className={connectorCss} aria-hidden="true" /> : null}
        </li>
      )
    })}
  </ol>
)
