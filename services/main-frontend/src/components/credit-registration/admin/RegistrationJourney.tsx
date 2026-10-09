"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle, Clock, ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React, { useId, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { formatDuration } from "@/utils/moduleTimeline"

import { CREDIT_REGISTRATION_NS, MIDDLE_DOT } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import { headingCss, noteCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { formatZonedTimeRange, formatZonedTimestamp } from "../ZonedTimestamp"
import { TONE_INK } from "./AdminStateLabel"
import type { JourneyPhase, JourneyPhaseKey, JourneyStep } from "./journeyPhases"
import type { TimelineEntry } from "./timelineRows"
import { timelinePhaseLabel, timelineStepLabel } from "./timelineSteps"

const MARKER_SIZE = 16
const SECS_PER_MINUTE = 60

const columnsCss = css`
  display: grid;
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;

  ${respondToOrLarger.lg} {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-4);
  }
`

const columnCss = css`
  display: grid;
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
  padding-top: var(--space-3);
  border-top: 3px solid var(--color-gray-200);
`

const PHASE_RULE_CSS = {
  done: css`
    border-top-color: var(--color-green-600);
  `,
  current: css`
    border-top-color: var(--color-blue-600);
  `,
  attention: css`
    border-top-color: var(--color-red-700);
  `,
}

const phaseNameCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
  font-weight: 600;
`

const phaseStatusCss = css`
  display: grid;
  gap: var(--space-1);
  margin: 0;
  font-size: var(--font-size-1);
`

const waitsOnCss = css`
  font-weight: 600;
`

const stepListCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

const stepCss = css`
  display: grid;
  grid-template-columns: ${MARKER_SIZE}px minmax(0, 1fr);
  column-gap: var(--space-2);
  align-items: start;
`

const markerCss = css`
  display: flex;
  margin-top: 0.15rem;
`

const hollowCss = css`
  width: ${MARKER_SIZE - 4}px;
  height: ${MARKER_SIZE - 4}px;
  margin: 2px;
  box-sizing: border-box;
  border: 2px solid var(--color-gray-400);
  border-radius: 50%;
`

const stepBodyCss = css`
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  font-size: var(--font-size-1);
`

const upcomingLabelCss = css`
  color: var(--color-gray-500);
`

const currentLabelCss = css`
  font-weight: 600;
`

const expandButtonCss = css`
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  text-decoration: underline dotted;
  text-underline-offset: 0.2em;
  cursor: pointer;

  &:hover {
    text-decoration-style: solid;
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const entriesCss = css`
  display: grid;
  gap: var(--space-2);
  margin: var(--space-1) 0 0;
  padding: var(--space-2) var(--space-3);
  border-left: 2px solid var(--color-clear-300);
  list-style: none;
`

const entryCss = css`
  display: grid;
  gap: 0.125rem;
  overflow-wrap: anywhere;
`

const attemptCss = css`
  margin: 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-0);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`

/** "36 min", or "under a minute" for steps one call apart. */
const durationText = (t: CreditRegistrationTFunction, secs: number): string =>
  secs < SECS_PER_MINUTE
    ? t("credit-registration-admin-journey-under-a-minute")
    : formatDuration(secs, t)

const StepMarker: React.FC<{ step: JourneyStep }> = ({ step }) => {
  if (step.status === "done") {
    return <CheckCircle size={MARKER_SIZE} className={TONE_INK.done} />
  }
  if (step.status === "current") {
    return step.isAttention ? (
      <ExclamationTriangle size={MARKER_SIZE} className={TONE_INK["action-needed"]} />
    ) : (
      <Clock size={MARKER_SIZE} className={TONE_INK.current} />
    )
  }
  return <span className={hollowCss} />
}

const stepStatusWord = (t: CreditRegistrationTFunction, step: JourneyStep): string => {
  switch (step.status) {
    case "done":
      return t("credit-registration-admin-journey-step-done")
    case "current":
      return t("credit-registration-admin-journey-step-current")
    case "upcoming":
      return t("credit-registration-admin-journey-step-upcoming")
  }
}

/** The events behind one step, with a heading wherever another attempt's events begin. */
const StepEntries: React.FC<{
  id: string
  entries: TimelineEntry[]
  currentAttemptId: string
  attemptNumber: (registrationId: string) => number | undefined
  showsAttempts: boolean
}> = ({ id, entries, currentAttemptId, attemptNumber, showsAttempts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <ul id={id} className={entriesCss}>
      {entries.map((entry, index) => {
        const startsAttempt =
          showsAttempts && (index === 0 || entries[index - 1]?.attemptId !== entry.attemptId)
        const n = attemptNumber(entry.attemptId)
        return (
          <li key={entry.id} className={entryCss}>
            {startsAttempt && n !== undefined && (
              <p className={attemptCss}>
                {entry.attemptId === currentAttemptId
                  ? t("credit-registration-admin-journey-this-attempt", { n })
                  : t("credit-registration-attempt-n", { n })}
              </p>
            )}
            <span
              className={
                entry.tone === "action-needed" || entry.tone === "failed"
                  ? TONE_INK[entry.tone]
                  : undefined
              }
            >
              {entry.sentence}
            </span>
            {entry.detail && <span className={noteCss}>{entry.detail}</span>}
            <span className={noteCss}>
              {entry.until
                ? formatZonedTimeRange(new Date(entry.at), new Date(entry.until))
                : formatZonedTimestamp(new Date(entry.at))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const StepItem: React.FC<{
  step: JourneyStep
  currentAttemptId: string
  attemptNumber: (registrationId: string) => number | undefined
  showsAttempts: boolean
}> = ({ step, currentAttemptId, attemptNumber, showsAttempts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [isExpanded, setIsExpanded] = useState(false)
  const entriesId = useId()
  const labelCss = cx(
    step.status === "upcoming" && upcomingLabelCss,
    step.status === "current" && currentLabelCss,
    step.status === "current" && step.isAttention && TONE_INK["action-needed"],
  )
  const timing =
    step.at === null
      ? null
      : [
          formatZonedTimestamp(new Date(step.at)),
          step.secsAfterPrevious === null
            ? null
            : t("credit-registration-admin-journey-later", {
                duration: durationText(t, step.secsAfterPrevious),
              }),
        ]
          .filter(Boolean)
          .join(MIDDLE_DOT)
  return (
    <li className={stepCss} aria-current={step.status === "current" ? "step" : undefined}>
      <span className={markerCss} aria-hidden>
        <StepMarker step={step} />
      </span>
      <span className={stepBodyCss}>
        <span className={labelCss}>
          <VisuallyHidden>{stepStatusWord(t, step)}: </VisuallyHidden>
          {step.entries.length > 0 ? (
            <button
              type="button"
              className={expandButtonCss}
              aria-expanded={isExpanded}
              aria-controls={isExpanded ? entriesId : undefined}
              onClick={() => setIsExpanded((open) => !open)}
            >
              {step.label}
            </button>
          ) : (
            step.label
          )}
        </span>
        {timing && <span className={noteCss}>{timing}</span>}
        {step.note && <span className={noteCss}>{step.note}</span>}
        {isExpanded && (
          <StepEntries
            id={entriesId}
            entries={step.entries}
            currentAttemptId={currentAttemptId}
            attemptNumber={attemptNumber}
            showsAttempts={showsAttempts}
          />
        )}
      </span>
    </li>
  )
}

const journeyPhaseLabel = (t: CreditRegistrationTFunction, key: JourneyPhaseKey): string =>
  key === "starting_registration"
    ? t("credit-registration-admin-timeline-phase-starting-registration")
    : timelinePhaseLabel(t, key)

/** How a phase stands: the outcome once finished, who it waits on while current, nothing before. */
const PhaseStatus: React.FC<{ phase: JourneyPhase }> = ({ phase }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (phase.current) {
    return (
      <p
        className={cx(
          phaseStatusCss,
          phase.current.tone === "attention" && TONE_INK["action-needed"],
        )}
      >
        <span className={waitsOnCss}>{phase.current.waitsOn}</span>
        {phase.current.next && <span>{phase.current.next}</span>}
      </p>
    )
  }
  if (phase.ending) {
    return (
      <p className={phaseStatusCss}>
        <span className={waitsOnCss}>{timelineStepLabel(t, phase.ending)}</span>
      </p>
    )
  }
  if (phase.status === "done") {
    return (
      <p className={cx(phaseStatusCss, TONE_INK.done)}>
        <span className={waitsOnCss}>{t("credit-registration-admin-journey-phase-done")}</span>
      </p>
    )
  }
  if (phase.status === "skipped") {
    return (
      <p className={cx(phaseStatusCss, noteCss)}>
        {phase.key === "starting_registration"
          ? t("credit-registration-admin-journey-page-not-used")
          : t("credit-registration-admin-journey-phase-skipped")}
      </p>
    )
  }
  return null
}

/**
 * The whole completion's story as phase columns, each a checklist of steps; stacks on phones.
 * Every attempt's page shows the same story, with its own attempt marked in the step details.
 */
const RegistrationJourney: React.FC<{
  phases: JourneyPhase[]
  currentAttemptId: string
  attemptNumber: (registrationId: string) => number | undefined
  showsAttempts: boolean
}> = ({ phases, currentAttemptId, attemptNumber, showsAttempts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-timeline")}
        </h2>
      </div>
      <p className={noteCss}>{t("credit-registration-admin-journey-note")}</p>
      <ol className={columnsCss}>
        {phases.map((phase) => (
          <li
            key={phase.key}
            className={cx(
              columnCss,
              phase.status === "done" && PHASE_RULE_CSS.done,
              phase.status === "current" &&
                (phase.current?.tone === "attention"
                  ? PHASE_RULE_CSS.attention
                  : PHASE_RULE_CSS.current),
            )}
          >
            <h3 className={phaseNameCss}>{journeyPhaseLabel(t, phase.key)}</h3>
            <PhaseStatus phase={phase} />
            {phase.steps.length > 0 && (
              <ol className={stepListCss}>
                {phase.steps.map((step) => (
                  <StepItem
                    key={step.key}
                    step={step}
                    currentAttemptId={currentAttemptId}
                    attemptNumber={attemptNumber}
                    showsAttempts={showsAttempts}
                  />
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default RegistrationJourney
