"use client"

import { css, cx } from "@emotion/css"
import {
  CheckCircle,
  Clock,
  ExclamationTriangle,
  MinusCircle,
  StopCircle,
  XmarkCircle,
} from "@vectopus/atlas-icons-react"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { AdminCreditRegistrationDetails } from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import type { RegistrationStatusState } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { adminLedgerStateLabel, stateTone } from "./adminCreditRegistrationCopy"
import { deriveRegistrationSteps } from "./registrationSteps"
import type { RegistrationStep, RegistrationStepStatus } from "./registrationSteps"
import { subStateExplanations } from "./registrationSubStates"

const MARKER_SIZE = 16

const listCss = css`
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;

  ${respondToOrLarger.sm} {
    flex-direction: row;
    gap: 0.5rem;
  }
`

const itemCss = css`
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 0 0 1rem 1.5rem;
  border-left: 2px solid var(--color-gray-400);

  &:last-child {
    padding-bottom: 0;
  }

  ${respondToOrLarger.sm} {
    padding: 1.25rem 0 0;
    border-left: 0;
    border-top: 2px solid var(--color-gray-400);
  }
`

/** Opaque so the connector line does not run through the glyph. */
const markerCss = css`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  width: ${MARKER_SIZE}px;
  height: ${MARKER_SIZE}px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary-100);
  transform: translate(calc(-50% - 1px), 0);

  ${respondToOrLarger.sm} {
    transform: translate(0, calc(-50% - 1px));
  }
`

const ringCss = css`
  width: 0.75rem;
  height: 0.75rem;
  box-sizing: border-box;
  border: 2px solid currentColor;
  border-radius: 50%;
`

const labelCss = css`
  font-size: 0.875rem;
  font-weight: 600;
`

const detailCss = css`
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: var(--color-gray-600);
`

type MarkerIcon = React.ComponentType<{ size?: number }>

interface Marker {
  Icon: MarkerIcon | null
  colorCss: string
}

const inkCss = (color: string): string => css`
  color: ${color};
`

const MARKERS = {
  done: { Icon: CheckCircle, colorCss: inkCss("var(--color-green-700)") },
  current: { Icon: Clock, colorCss: inkCss("var(--color-gray-600)") },
  skipped: { Icon: MinusCircle, colorCss: inkCss("var(--color-gray-400)") },
  upcoming: { Icon: null, colorCss: inkCss("var(--color-gray-400)") },
  stoppedFailed: { Icon: XmarkCircle, colorCss: inkCss("var(--color-crimson-700)") },
  stoppedNeedsAction: { Icon: ExclamationTriangle, colorCss: inkCss("var(--color-red-700)") },
  stoppedIdle: { Icon: StopCircle, colorCss: inkCss("var(--color-gray-500)") },
} as const satisfies Record<string, Marker>

const markerFor = (status: RegistrationStepStatus, tone: RegistrationStatusState): Marker => {
  if (status !== "stopped") {
    return MARKERS[status]
  }
  switch (tone) {
    case "failed":
      return MARKERS.stoppedFailed
    case "upcoming":
    case "superseded":
      return MARKERS.stoppedIdle
    default:
      return MARKERS.stoppedNeedsAction
  }
}

const stepLabel = (t: CreditRegistrationTFunction, step: RegistrationStep): string => {
  switch (step.ending) {
    case "duplicate":
      return t("credit-registration-admin-stepper-already-in-sisu")
    case "not_improved":
      return t("credit-registration-admin-stepper-not-improved")
    case undefined:
      break
  }
  switch (step.key) {
    case "completed":
      return t("credit-registration-admin-stepper-completed")
    case "enrolment":
      return t("credit-registration-admin-stepper-enrolment")
    case "sent":
      return t("credit-registration-admin-stepper-sent")
    case "partial":
      return t("credit-registration-admin-stepper-partial")
    case "registered":
      return t("credit-registration-admin-stepper-registered")
  }
}

const stepStatusWord = (t: CreditRegistrationTFunction, status: RegistrationStepStatus): string => {
  switch (status) {
    case "done":
      return t("credit-registration-admin-stepper-done")
    case "current":
      return t("credit-registration-admin-stepper-in-progress")
    case "stopped":
      return t("credit-registration-admin-stepper-stopped")
    case "skipped":
      return t("credit-registration-admin-stepper-skipped")
    case "upcoming":
      return t("credit-registration-admin-stepper-upcoming")
  }
}

const stepDetail = (
  t: CreditRegistrationTFunction,
  step: RegistrationStep,
  activeText: string,
): string => {
  const time = step.at ? formatZonedTimestamp(new Date(step.at)) : null
  switch (step.status) {
    case "done":
      return time ?? t("credit-registration-admin-stepper-done")
    case "current":
    case "stopped":
      return time ? `${time}. ${activeText}` : activeText
    case "skipped":
      return t("credit-registration-admin-stepper-skipped")
    case "upcoming":
      return t("credit-registration-admin-stepper-upcoming")
  }
}

/** Horizontal (vertical on phones) lifecycle of a registration from completion to Sisu. */
const RegistrationStepper: React.FC<{ details: AdminCreditRegistrationDetails; now: number }> = ({
  details,
  now,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const row = details.registration
  const steps = deriveRegistrationSteps(row, details.events)
  const activeText =
    subStateExplanations(t, row, details.attention_thresholds, now)[0] ??
    adminLedgerStateLabel(t, row.state, row.pending_reason)
  const tone = stateTone(row.state, row.pending_reason)
  return (
    <ol className={listCss} aria-label={t("credit-registration-admin-stepper-label")}>
      {steps.map((step) => {
        const { Icon, colorCss } = markerFor(step.status, tone)
        return (
          <li
            key={step.key}
            className={itemCss}
            aria-current={step.status === "current" ? "step" : undefined}
          >
            <span className={cx(markerCss, colorCss)}>
              {Icon ? <Icon size={MARKER_SIZE} /> : <span className={ringCss} />}
            </span>
            <div className={labelCss}>
              <VisuallyHidden>{stepStatusWord(t, step.status)}: </VisuallyHidden>
              {stepLabel(t, step)}
            </div>
            <div className={detailCss}>{stepDetail(t, step, activeText)}</div>
          </li>
        )
      })}
    </ol>
  )
}

export default RegistrationStepper
