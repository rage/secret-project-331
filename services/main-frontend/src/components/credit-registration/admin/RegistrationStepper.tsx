"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { AdminCreditRegistrationDetails } from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { CREDIT_REGISTRATION_NS } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import { registrationLedgerStateLabel } from "../creditRegistrationCopy"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { stateTone } from "./adminCreditRegistrationCopy"
import { deriveRegistrationSteps } from "./registrationSteps"
import type { RegistrationStep, RegistrationStepStatus } from "./registrationSteps"
import { subStateExplanations } from "./registrationSubStates"

const DOT_SIZE = "0.75rem"

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
  border-left: 2px solid var(--color-gray-300);

  &:last-child {
    padding-bottom: 0;
  }

  ${respondToOrLarger.sm} {
    padding: 1.25rem 0 0;
    border-left: 0;
    border-top: 2px solid var(--color-gray-300);
  }
`

const dotCss = css`
  position: absolute;
  top: 0;
  left: 0;
  width: ${DOT_SIZE};
  height: ${DOT_SIZE};
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid var(--dot-color);
  background: var(--dot-fill);
  transform: translate(calc(-50% - 1px), 0);

  ${respondToOrLarger.sm} {
    transform: translate(0, calc(-50% - 1px));
  }
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

const currentLabelCss = css`
  color: var(--color-blue-700);
`

const STATUS_STYLE: Record<RegistrationStepStatus, string> = {
  done: css`
    --dot-color: var(--color-green-700);
    --dot-fill: var(--color-green-700);
  `,
  current: css`
    --dot-color: var(--color-blue-600);
    --dot-fill: var(--color-blue-600);
  `,
  stopped: css`
    --dot-color: var(--color-red-700);
    --dot-fill: var(--color-red-700);
  `,
  skipped: css`
    --dot-color: var(--color-gray-400);
    --dot-fill: var(--color-gray-100);
  `,
  upcoming: css`
    --dot-color: var(--color-gray-400);
    --dot-fill: transparent;
  `,
}

const STOPPED_STYLE = {
  failed: css`
    --dot-color: var(--color-crimson-700);
    --dot-fill: var(--color-crimson-700);
  `,
  neutral: css`
    --dot-color: var(--color-gray-500);
    --dot-fill: var(--color-gray-500);
  `,
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
    case "enrolment_found":
      return t("credit-registration-admin-stepper-enrolment-found")
    case "sent":
      return t("credit-registration-admin-stepper-sent")
    case "partial":
      return t("credit-registration-admin-stepper-partial")
    case "registered":
      return t("credit-registration-admin-stepper-registered")
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
    registrationLedgerStateLabel(t, row.state, row.pending_reason)
  const tone = stateTone(row.state, row.pending_reason)
  return (
    <ol className={listCss} aria-label={t("credit-registration-admin-stepper-label")}>
      {steps.map((step) => {
        const stoppedStyle =
          step.status === "stopped"
            ? tone === "failed"
              ? STOPPED_STYLE.failed
              : tone === "upcoming"
                ? STOPPED_STYLE.neutral
                : undefined
            : undefined
        return (
          <li
            key={step.key}
            className={cx(itemCss, STATUS_STYLE[step.status], stoppedStyle)}
            aria-current={step.status === "current" ? "step" : undefined}
          >
            <span className={dotCss} aria-hidden />
            <div className={cx(labelCss, step.status === "current" && currentLabelCss)}>
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
