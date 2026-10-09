"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React, { useId, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { ChevronIcon } from "@/shared-module/components/components/primitives/ChevronIcon"

import { CREDIT_REGISTRATION_NS } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import { formatDurationInWords } from "../durationWords"
import { headingCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import UnbrokenValuesText from "../UnbrokenValuesText"
import { formatZonedTimeRange, formatZonedTimestamp, ZonedTimestamp } from "../ZonedTimestamp"
import type {
  JourneyPhase,
  JourneyPhaseKey,
  JourneyPhaseStatus,
  JourneyProblem,
  JourneySubstep,
  JourneySubstepStatus,
} from "./journeyPhases"
import type { TimelineEntry } from "./timelineRows"
import { timelinePhaseLabel, timelineStepLabel } from "./timelineSteps"

const CHEVRON_RIGHT = "right" as const
const WARNING_ICON_SIZE = 20

/** Phases sit side by side from this container width; below it they stack on a vertical line. */
const ACROSS_MIN_PX = 1220
/** Below this container width the markers and indents shrink to leave phones the text. */
const PHONE_MAX_PX = 600
/** From this container width a stacked substep's times move to a column of their own. */
const TIME_COLUMN_MIN_PX = 640

const bodyCss = css`
  container-type: inline-size;
`

/** Phones reclaim the card's side padding for the timeline's text. */
const PHONE_CARD_PADDING_MAX_PX = 560

const sectionCss = css`
  @media (max-width: ${PHONE_CARD_PADDING_MAX_PX}px) {
    padding-right: var(--space-3-5);
    padding-left: var(--space-3-5);

    > :first-child {
      margin-right: calc(var(--space-3-5) * -1);
      margin-left: calc(var(--space-3-5) * -1);
      padding-right: var(--space-3-5);
      padding-left: var(--space-3-5);
    }
  }
`

// One block so every part restyles together per container width.
const timelineCss = css`
  --node: 28px;
  --col-gap: var(--space-4);
  --rail: var(--color-clear-400);
  --upcoming-dot: var(--color-gray-400);
  --done: var(--color-green-600);
  --done-line: var(--color-green-200);
  --current: var(--color-blue-600);
  --current-soft: var(--color-blue-100);
  --attention: var(--color-crimson-600);
  --inset: var(--color-clear-100);
  --muted: var(--color-gray-500);

  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-gray-700);

  time {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tl-node {
    flex: none;
    position: relative;
    display: grid;
    place-items: center;
    width: var(--node);
    height: var(--node);
    box-sizing: border-box;
    border: 2px solid var(--rail);
    border-radius: 50%;
    background: var(--color-clear-50);
    color: var(--muted);
    font-size: var(--font-size-0);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .tl-phase[data-status="done"] .tl-node {
    border-color: var(--done);
    background: var(--done);
    color: var(--color-clear-50);
  }
  .tl-phase[data-status="current"] .tl-node {
    border-color: var(--current);
    background: var(--current-soft);
    color: var(--current);
  }
  .tl-phase[data-status="attention"] .tl-node {
    border-color: var(--attention);
    background: var(--attention);
    color: var(--color-clear-50);
  }
  .tl-phase[data-status="skipped"] .tl-node {
    border-style: dashed;
  }

  .tl-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }
  .tl-titles {
    min-width: 0;
  }
  .tl-name {
    margin: 0;
    font-size: var(--font-size-2);
    font-weight: 600;
    line-height: var(--node);
  }
  .tl-state {
    margin: -4px 0 0;
    font-size: var(--font-size-0);
    font-weight: 600;
  }
  .tl-phase[data-status="done"] .tl-state {
    color: var(--done);
  }
  .tl-phase[data-status="attention"] .tl-state {
    color: var(--attention);
  }
  .tl-phase[data-status="upcoming"],
  .tl-phase[data-status="skipped"] {
    .tl-name,
    .tl-state {
      color: var(--muted);
      font-weight: 500;
    }
  }

  .tl-panel {
    min-width: 0;
    padding: var(--space-3-5);
    border: 1px solid var(--color-clear-300);
    border-radius: 10px;
    background: var(--color-clear-50);
  }
  .tl-phase:nth-child(even) .tl-panel {
    border-color: transparent;
    background: var(--inset);
  }
  .tl-phase[data-status="skipped"] .tl-panel {
    border: 1px dashed var(--upcoming-dot);
    background: var(--color-clear-50);
  }
  .tl-note {
    margin: 0;
    color: var(--muted);
    font-size: var(--font-size-1);
  }

  .tl-substeps {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tl-substep {
    position: relative;
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    column-gap: var(--space-3);
    padding: 2px 0;
    font-size: var(--font-size-1);
  }
  /* The sub-line runs from each dot to the next, so it stops at the last one. */
  .tl-substep:not(:last-child)::before {
    content: "";
    position: absolute;
    top: 13px;
    bottom: -19px;
    left: 7px;
    width: 2px;
    background: var(--rail);
  }
  .tl-substep[data-status="done"]:not(:last-child)::before {
    background: var(--done-line);
  }
  .tl-dot {
    position: relative;
    z-index: 1;
    justify-self: center;
    width: 10px;
    height: 10px;
    margin-top: 6px;
    box-sizing: border-box;
    border: 2px solid var(--upcoming-dot);
    border-radius: 50%;
    background: var(--color-clear-50);
  }
  .tl-substep[data-status="done"] > .tl-dot {
    border-color: var(--done);
    background: var(--done);
  }
  .tl-substep[data-status="current"] > .tl-dot {
    border-color: var(--current);
    background: var(--current);
  }
  .tl-substep[data-status="attention"] > .tl-dot {
    border-color: var(--attention);
    background: var(--attention);
    box-shadow: 0 0 0 3px var(--color-crimson-100);
  }
  .tl-substep > :not(.tl-dot) {
    grid-column: 2;
  }
  .tl-label {
    min-width: 0;
  }
  .tl-substep[data-status="upcoming"] .tl-label {
    color: var(--muted);
  }
  .tl-substep[data-status="current"] .tl-label,
  .tl-substep[data-status="attention"] .tl-label {
    font-weight: 600;
  }
  .tl-detail {
    display: block;
    color: var(--muted);
    font-size: var(--font-size-0);
    font-weight: 400;
  }
  .tl-when {
    color: var(--muted);
    font-size: var(--font-size-0);
  }
  .tl-gap {
    display: block;
  }
  .tl-details {
    display: inline-flex;
    justify-self: start;
    align-items: center;
    gap: var(--space-2);
    margin-top: 2px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--current);
    font: inherit;
    font-size: var(--font-size-0);
    font-weight: 500;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    &:focus-visible {
      outline: 2px solid var(--current);
      outline-offset: 2px;
    }
    svg {
      transition: transform 0.15s;
    }
    &[aria-expanded="true"] svg {
      transform: rotate(90deg);
    }
  }
  /* Indented past the sub-line so the line keeps running beside open details. */
  .tl-substep > .tl-events {
    display: grid;
    grid-column: 1 / -1;
    gap: var(--space-3);
    margin: 6px 0 4px var(--space-4);
    padding: 6px var(--space-3);
    border-radius: var(--surface-radius);
    background: var(--inset);
    font-size: var(--font-size-0);
    list-style: none;
  }
  .tl-phase:nth-child(even) .tl-events {
    background: var(--color-clear-50);
  }
  .tl-events li {
    display: grid;
  }
  .tl-event-text {
    font-size: var(--font-size-1);
  }
  .tl-event-time,
  .tl-event-detail {
    color: var(--muted);
  }
  .tl-attempt {
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .tl-problem-heading {
    margin: 0;
    color: var(--attention);
    font-size: var(--font-size-2);
    font-weight: 600;
  }
  .tl-problem-body {
    display: grid;
    flex: 1;
    gap: var(--space-2);
    min-width: 0;
  }
  .tl-problem-body p {
    margin: 0;
  }
  .tl-problem-since,
  .tl-problem-hint {
    color: var(--muted);
    font-size: var(--font-size-1);
  }
  .tl-problem-actions {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  @container (min-width: ${ACROSS_MIN_PX}px) {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    column-gap: var(--col-gap);

    /* Every phase spans the full width on a subgrid so its problem box can run under all five
       panels while staying inside the phase in reading order. The phase box itself is transparent,
       so it must not take clicks meant for the phases it overlaps. */
    .tl-phase {
      display: grid;
      grid-row: 1 / span 3;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      grid-template-rows: subgrid;
      pointer-events: none;
    }
    .tl-phase > * {
      pointer-events: auto;
    }
    .tl-head {
      grid-row: 1;
      grid-column: var(--col);
    }
    .tl-panel {
      grid-row: 2;
      grid-column: var(--col);
      margin-top: var(--space-3-5);
    }
    .tl-problem {
      grid-row: 3;
      grid-column: 1 / -1;
      margin-top: var(--space-4);
    }
    .tl-connector {
      flex: 1;
      min-width: 12px;
      height: 2px;
      margin: 13px calc(-1 * var(--col-gap)) 0 0;
      background: var(--rail);
    }
    .tl-phase[data-to-done] .tl-connector {
      background: var(--done);
    }
    .tl-phase:last-child .tl-connector {
      display: none;
    }
  }

  @container (max-width: ${ACROSS_MIN_PX - 0.02}px) {
    display: grid;

    .tl-phase {
      position: relative;
      display: grid;
      grid-template-columns: var(--node) minmax(0, 1fr);
      column-gap: var(--space-4);
      padding-bottom: 20px;
    }
    .tl-phase:last-child {
      padding-bottom: 0;
    }
    .tl-phase::before {
      content: "";
      position: absolute;
      top: var(--node);
      bottom: 0;
      left: calc(var(--node) / 2 - 1px);
      width: 2px;
      background: var(--rail);
    }
    .tl-phase[data-to-done]::before {
      background: var(--done);
    }
    .tl-phase:last-child::before {
      display: none;
    }
    .tl-head {
      grid-column: 1 / -1;
      gap: var(--space-4);
    }
    .tl-connector {
      display: none;
    }
    .tl-panel,
    .tl-problem {
      grid-column: 2;
      margin-top: var(--space-3);
    }
  }

  /* Stacked with room to spare: times go in a right-hand column. */
  @container (min-width: ${TIME_COLUMN_MIN_PX}px) and (max-width: ${ACROSS_MIN_PX - 0.02}px) {
    .tl-substep {
      grid-template-columns: 16px minmax(0, 1fr) auto;
      column-gap: var(--space-4);
    }
    .tl-substep > .tl-label {
      grid-row: 1 / span 2;
    }
    .tl-substep > .tl-when {
      grid-row: 1 / span 2;
      grid-column: 3;
      text-align: right;
    }
    .tl-substep > .tl-details {
      grid-row: 3;
      grid-column: 2;
    }
    .tl-substep > .tl-events {
      grid-row: 4;
      grid-column: 1 / -1;
    }
  }

  @container (max-width: ${PHONE_MAX_PX - 0.02}px) {
    --node: 24px;

    .tl-phase {
      column-gap: 10px;
    }
    .tl-head {
      gap: 10px;
    }
    .tl-name {
      font-size: var(--font-size-1);
    }
    .tl-panel {
      padding: 10px;
    }
    /* Like the infobox on phones: icon inline with the heading, text and buttons full width. */
    .tl-problem {
      display: block;
      padding: var(--space-3-5);
    }
    .tl-problem > span:first-child {
      float: left;
      margin-right: var(--space-3);
    }
    .tl-problem-body {
      display: block;
    }
    .tl-problem-body > * {
      display: block;
      margin-top: var(--space-2);
    }
    .tl-problem-body > .tl-problem-actions {
      display: grid;
      margin-top: var(--space-3);
    }
    /* One full-width button per line, the ones set apart included. */
    .tl-problem-actions div > *,
    .tl-problem-actions span > * {
      flex: 1 1 100%;
      margin-left: 0;
    }
    .tl-problem-actions button,
    .tl-problem-actions a {
      width: 100%;
      height: auto;
      min-height: var(--control-height-md);
      padding-top: var(--space-2);
      padding-bottom: var(--space-2);
      line-height: 1.25;
      white-space: normal;
    }
  }

  /* In progress: one wave at a time swells from behind the marker. Waves paint behind the marker
     but in front of the panel, so the number and dot stay crisp. The dot is a third of the node's
     size, so its wave travels further to read at the same size. */
  .tl-phase[data-status="current"] .tl-head {
    position: relative;
    z-index: 0;
  }
  .tl-substep[data-status="current"] {
    z-index: 0;
  }
  .tl-substep[data-status="current"] > .tl-dot {
    z-index: auto;
  }
  .tl-phase[data-status="current"] .tl-node::before,
  .tl-substep[data-status="current"] > .tl-dot::before {
    content: "";
    position: absolute;
    z-index: -1;
    inset: -2px;
    border-radius: 50%;
    background: var(--current);
    pointer-events: none;
    animation: tl-wave 2s cubic-bezier(0.15, 0.55, 0.3, 1) infinite;
  }
  .tl-phase[data-status="current"] .tl-node {
    --reach: 1.55;
  }
  .tl-substep[data-status="current"] > .tl-dot {
    --reach: 2.3;
  }
  @keyframes tl-wave {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    100% {
      transform: scale(var(--reach));
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tl-phase[data-status="current"] .tl-node::before,
    .tl-substep[data-status="current"] > .tl-dot::before {
      animation: none;
      opacity: 0;
    }
  }
`

/** The danger infobox's look, as a grid item of the timeline rather than the shared component. */
const problemCss = css`
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 14px var(--space-4);
  border-left: 3px solid var(--color-crimson-600);
  border-radius: 0 var(--surface-radius) var(--surface-radius) 0;
  background: var(--color-crimson-75);

  > span:first-child {
    display: inline-flex;
    flex: none;
    margin-top: 2px;
    color: var(--color-crimson-600);
  }
`

/** The phase's column when they sit side by side. */
const columnCss = (column: number) => css`
  --col: ${column};
`

const SUBSTEP_STATUS_KEYS = {
  done: "credit-registration-admin-journey-step-done",
  current: "credit-registration-admin-journey-step-current",
  attention: "credit-registration-admin-journey-step-attention",
  upcoming: "credit-registration-admin-journey-step-upcoming",
} as const satisfies Record<JourneySubstepStatus, string>

const journeyPhaseLabel = (t: CreditRegistrationTFunction, key: JourneyPhaseKey): string =>
  key === "starting_registration"
    ? t("credit-registration-admin-timeline-phase-starting-registration")
    : timelinePhaseLabel(t, key)

/** The state beside a phase's name: the outcome once finished, otherwise where it stands. */
const phaseStateLabel = (t: CreditRegistrationTFunction, phase: JourneyPhase): string => {
  if (phase.ending) {
    return timelineStepLabel(t, phase.ending)
  }
  switch (phase.status) {
    case "done":
      return t("credit-registration-admin-journey-phase-done")
    case "current":
      return t("credit-registration-admin-journey-phase-current")
    case "attention":
      return phase.problem?.waitsOn ?? t("credit-registration-admin-journey-step-attention")
    case "upcoming":
      return t("credit-registration-admin-journey-phase-upcoming")
    case "skipped":
      return phase.key === "starting_registration"
        ? t("credit-registration-admin-journey-page-not-used")
        : t("credit-registration-admin-journey-phase-skipped")
  }
}

const entryTime = (entry: TimelineEntry): string =>
  entry.until
    ? formatZonedTimeRange(new Date(entry.at), new Date(entry.until))
    : formatZonedTimestamp(new Date(entry.at))

/** The events behind one substep, with a heading wherever another attempt's events begin. */
const SubstepEvents: React.FC<{
  id: string
  isOpen: boolean
  entries: TimelineEntry[]
  currentAttemptId: string
  attemptNumber: (registrationId: string) => number | undefined
  showsAttempts: boolean
}> = ({ id, isOpen, entries, currentAttemptId, attemptNumber, showsAttempts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <ul id={id} className="tl-events" hidden={!isOpen}>
      {entries.map((entry, index) => {
        const previous = entries[index - 1]
        const startsAttempt =
          showsAttempts && (previous === undefined || previous.attemptId !== entry.attemptId)
        const n = attemptNumber(entry.attemptId)
        const time = entryTime(entry)
        // Repeating the same second on consecutive rows says nothing new.
        const showsTime = startsAttempt || previous === undefined || entryTime(previous) !== time
        return (
          <React.Fragment key={entry.id}>
            {startsAttempt && n !== undefined && (
              <li className="tl-attempt">
                {entry.attemptId === currentAttemptId
                  ? t("credit-registration-admin-journey-this-attempt", { n })
                  : t("credit-registration-attempt-n", { n })}
              </li>
            )}
            <li>
              <span className="tl-event-text">
                <UnbrokenValuesText>{entry.sentence}</UnbrokenValuesText>
              </span>
              {showsTime && (
                <span className="tl-event-time">
                  {entry.until ? (
                    <time dateTime={entry.at}>{time}</time>
                  ) : (
                    <ZonedTimestamp at={entry.at} />
                  )}
                </span>
              )}
              {entry.detail && (
                <span className="tl-event-detail">
                  <UnbrokenValuesText>{entry.detail}</UnbrokenValuesText>
                </span>
              )}
            </li>
          </React.Fragment>
        )
      })}
    </ul>
  )
}

const SubstepItem: React.FC<{
  substep: JourneySubstep
  currentAttemptId: string
  attemptNumber: (registrationId: string) => number | undefined
  showsAttempts: boolean
}> = ({ substep, currentAttemptId, attemptNumber, showsAttempts }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [isOpen, setIsOpen] = useState(false)
  const eventsId = useId()
  const labelId = useId()
  return (
    <li
      className="tl-substep"
      data-status={substep.status}
      aria-current={
        substep.status === "current" || substep.status === "attention" ? "step" : undefined
      }
    >
      <span className="tl-dot" aria-hidden="true" />
      <span className="tl-label" id={labelId}>
        <VisuallyHidden>{t(SUBSTEP_STATUS_KEYS[substep.status])}: </VisuallyHidden>
        {substep.label}
        {substep.detail && (
          <span className="tl-detail">
            <UnbrokenValuesText>{substep.detail}</UnbrokenValuesText>
          </span>
        )}
      </span>
      {substep.at && (
        <span className="tl-when">
          <ZonedTimestamp at={substep.at} />
          {substep.secsAfterPrevious !== null && (
            <span className="tl-gap">
              {t("credit-registration-admin-journey-later", {
                duration: formatDurationInWords(t, substep.secsAfterPrevious),
              })}
              <VisuallyHidden>
                {" "}
                {t("credit-registration-admin-journey-later-context")}
              </VisuallyHidden>
            </span>
          )}
        </span>
      )}
      {substep.entries.length > 0 && (
        <>
          <button
            type="button"
            className="tl-details"
            aria-expanded={isOpen}
            aria-controls={eventsId}
            aria-describedby={labelId}
            onClick={() => setIsOpen((open) => !open)}
          >
            <ChevronIcon direction={CHEVRON_RIGHT} />
            {t("credit-registration-admin-journey-details", { count: substep.entries.length })}
          </button>
          <SubstepEvents
            id={eventsId}
            isOpen={isOpen}
            entries={substep.entries}
            currentAttemptId={currentAttemptId}
            attemptNumber={attemptNumber}
            showsAttempts={showsAttempts}
          />
        </>
      )}
    </li>
  )
}

const ProblemBox: React.FC<{
  phaseName: string
  problem: JourneyProblem
  actions: React.ReactNode
}> = ({ phaseName, problem, actions }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={cx("tl-problem", problemCss)} aria-labelledby={headingId}>
      <span aria-hidden="true">
        <ExclamationTriangle size={WARNING_ICON_SIZE} />
      </span>
      <div className="tl-problem-body">
        <h4 id={headingId} className="tl-problem-heading">
          {t("credit-registration-admin-journey-problem-heading", {
            phase: phaseName,
            waitsOn: problem.waitsOn.charAt(0).toLocaleLowerCase() + problem.waitsOn.slice(1),
          })}
        </h4>
        <span className="tl-problem-since">
          {t("credit-registration-admin-journey-problem-since")}{" "}
          <ZonedTimestamp at={problem.since} />
        </span>
        {problem.summary && (
          <p>
            <UnbrokenValuesText>{problem.summary}</UnbrokenValuesText>
          </p>
        )}
        {problem.hint && (
          <p className="tl-problem-hint">
            <UnbrokenValuesText>{problem.hint}</UnbrokenValuesText>
          </p>
        )}
        {actions && <div className="tl-problem-actions">{actions}</div>}
      </div>
    </section>
  )
}

const leadsIntoDone = (next: JourneyPhaseStatus | undefined): boolean =>
  next === "done" || next === "skipped"

/**
 * The whole completion's story as numbered steps with substeps, side by side in a wide container
 * and stacked below that. Every attempt's page shows the same story, its own attempt marked.
 * `problemActions` go in the problem box of a phase that waits for a person.
 */
const RegistrationJourney: React.FC<{
  phases: JourneyPhase[]
  currentAttemptId: string
  attemptNumber: (registrationId: string) => number | undefined
  showsAttempts: boolean
  problemActions: React.ReactNode
}> = ({ phases, currentAttemptId, attemptNumber, showsAttempts, problemActions }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  return (
    <section className={cx(sectionCardCss, sectionCss)} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-timeline")}
        </h2>
      </div>
      <div className={bodyCss}>
        <ol className={timelineCss} aria-label={t("credit-registration-admin-journey-steps-label")}>
          {phases.map((phase, index) => {
            const name = journeyPhaseLabel(t, phase.key)
            return (
              <li
                key={phase.key}
                className={cx("tl-phase", columnCss(index + 1))}
                data-status={phase.status}
                data-to-done={leadsIntoDone(phases[index + 1]?.status) ? "" : undefined}
                aria-current={
                  phase.status === "current" || phase.status === "attention" ? "step" : undefined
                }
              >
                <div className="tl-head">
                  <span className="tl-node" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="tl-titles">
                    <h3 className="tl-name">
                      <VisuallyHidden>
                        {t("credit-registration-admin-journey-step-n-of", {
                          n: index + 1,
                          total: phases.length,
                        })}{" "}
                      </VisuallyHidden>
                      {name}
                    </h3>
                    <p className="tl-state">{phaseStateLabel(t, phase)}</p>
                  </div>
                  <span className="tl-connector" aria-hidden="true" />
                </div>
                <div className="tl-panel">
                  {phase.status === "skipped" && phase.key === "starting_registration" && (
                    <p className="tl-note">
                      {t("credit-registration-admin-journey-page-not-opened")}
                    </p>
                  )}
                  {phase.substeps.length > 0 && (
                    <ol className="tl-substeps">
                      {phase.substeps.map((substep) => (
                        <SubstepItem
                          key={substep.key}
                          substep={substep}
                          currentAttemptId={currentAttemptId}
                          attemptNumber={attemptNumber}
                          showsAttempts={showsAttempts}
                        />
                      ))}
                    </ol>
                  )}
                </div>
                {phase.problem && (
                  <ProblemBox phaseName={name} problem={phase.problem} actions={problemActions} />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

export default RegistrationJourney
