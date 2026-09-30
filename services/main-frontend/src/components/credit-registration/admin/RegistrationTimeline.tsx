"use client"

import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type {
  AdminCreditRegistrationEvent,
  AdminCreditRegistrationRow,
} from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import type { RegistrationStatusState } from "@/shared-module/components"
import { Button, Dialog } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, STEP_RESULT_SEPARATOR } from "../constants"
import {
  codeValueCss,
  dividedListCss,
  headingCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  stackedCellCss,
} from "../styles"
import { formatZonedTimeRange, ZonedTimestamp } from "../ZonedTimestamp"
import AdminStateLabel, { TONE_INK } from "./AdminStateLabel"
import ErrorCodeCell from "./ErrorCodeCell"
import PayloadBlock from "./PayloadBlock"
import type { TimelineGroup, TimelineRow } from "./timelineRows"
import { buildTimeline } from "./timelineRows"
import { TIMELINE_STEP_ICONS } from "./timelineStepIcons"

const STEP_ICON_SIZE = 16

const entryCss = css`
  display: grid;
  gap: var(--space-2) var(--space-4);
  grid-template-columns: minmax(0, 1fr);

  ${respondToOrLarger.md} {
    grid-template-columns: minmax(0, 14rem) minmax(0, 1fr) minmax(0, 16rem);
  }
`

const mainCss = css`
  display: grid;
  gap: var(--space-2);
  align-content: start;
`

const headlineCss = css`
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
`

const iconCss = css`
  flex: none;
  align-self: center;
  display: inline-flex;
  color: var(--color-gray-500);
`

const stepCss = css`
  font-weight: 500;
`

/** Upcoming and superseded ink is a faint gray meant for glyphs; as text it falls below contrast. */
const resultInk = (tone: RegistrationStatusState): string | undefined =>
  tone === "upcoming" || tone === "superseded" ? undefined : TONE_INK[tone]

const PayloadDialog: React.FC<{ title: string; payload: unknown }> = ({ title, payload }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="tertiary" size="small" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-show-exchange")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="wide" title={title}>
        <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
        <PayloadBlock body={payload} />
      </Dialog>
    </>
  )
}

const TimelineEntry: React.FC<{
  row: TimelineRow
  /** A collapsed run's rows, oldest first; the entry then stands for all of them. */
  run?: TimelineRow[]
  actorName: string | undefined
  children?: React.ReactNode
}> = ({ row, run, actorName, children }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { event, description } = row
  const StepIcon = TIMELINE_STEP_ICONS[description.step]
  const newest = run?.at(-1)
  const errorCode = event.error_code
  const hasPayload = !run && event.details !== null && event.details !== undefined
  // An admin row names its actor in the result already.
  const showsActor = actorName !== undefined && description.step !== "admin"
  const hasChips = Boolean(errorCode) || showsActor || hasPayload || Boolean(children)

  return (
    <li className={entryCss}>
      <span className={cx(stackedCellCss, noteCss)}>
        {run && newest ? (
          <span>{formatZonedTimeRange(new Date(row.at), new Date(newest.at))}</span>
        ) : (
          <ZonedTimestamp at={row.at} />
        )}
        {!run && row.duration && <span>{row.duration}</span>}
      </span>
      <span className={mainCss}>
        <span className={headlineCss}>
          <span className={iconCss} aria-hidden="true">
            <StepIcon size={STEP_ICON_SIZE} />
          </span>
          <span>
            <span className={stepCss}>
              {description.stepLabel}
              {STEP_RESULT_SEPARATOR}
            </span>
            <span className={resultInk(description.tone)}>{description.result}</span>
            {run && (
              <span className={noteCss}>
                {" "}
                {t("credit-registration-admin-timeline-repeat", { n: run.length })}
              </span>
            )}
          </span>
        </span>
        {description.detail && <span className={cx(noteCss, proseCss)}>{description.detail}</span>}
        {hasChips && (
          <span className={rowCss}>
            {errorCode &&
              (description.resultNamesError ? (
                <code className={cx(noteCss, codeValueCss)}>{errorCode}</code>
              ) : (
                <ErrorCodeCell errorCode={errorCode} />
              ))}
            {showsActor && (
              <span className={noteCss}>
                {t("credit-registration-admin-event-actor", { actor: actorName })}
              </span>
            )}
            {hasPayload && (
              <PayloadDialog
                title={t("credit-registration-heading-exchange", { kind: description.stepLabel })}
                payload={event.details}
              />
            )}
            {children}
          </span>
        )}
      </span>
      <span>
        {row.changedState && event.to_state ? (
          <AdminStateLabel state={event.to_state} />
        ) : (
          <span className={noteCss}>{t("credit-registration-admin-timeline-unchanged")}</span>
        )}
      </span>
    </li>
  )
}

const TimelineGroupEntries: React.FC<{
  group: TimelineGroup
  actorNameOf: (event: AdminCreditRegistrationEvent) => string | undefined
}> = ({ group, actorNameOf }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [expanded, setExpanded] = useState(false)
  const [first, ...rest] = group.rows
  const renderRow = (row: TimelineRow) => (
    <TimelineEntry key={row.event.id} row={row} actorName={actorNameOf(row.event)} />
  )
  if (rest.length === 0) {
    return renderRow(first)
  }
  return (
    <>
      <TimelineEntry row={first} run={group.rows} actorName={actorNameOf(first.event)}>
        <Button variant="tertiary" size="small" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? t("credit-registration-admin-timeline-run-hide")
            : t("credit-registration-admin-timeline-run-show", { count: group.rows.length })}
        </Button>
      </TimelineEntry>
      {expanded && group.rows.map(renderRow)}
    </>
  )
}

/** The registration's event log as "step: result" rows, oldest first. */
const RegistrationTimeline: React.FC<{
  events: AdminCreditRegistrationEvent[]
  registration: AdminCreditRegistrationRow
  actorNames: Map<string, string>
}> = ({ events, registration, actorNames }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const actorName = (userId: string) => actorNames.get(userId)
  const groups = buildTimeline(t, events, {
    uhCourseCode: registration.uh_course_code ?? null,
    selectedEnrolmentId: registration.selected_enrolment_id ?? null,
    actorName,
  })
  const actorNameOf = (event: AdminCreditRegistrationEvent) =>
    event.actor_user_id ? actorName(event.actor_user_id) : undefined
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-timeline")}</h2>
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role */}
      <ol className={dividedListCss} role="list">
        {groups.map((group) => (
          <TimelineGroupEntries
            key={group.rows[0].event.id}
            group={group}
            actorNameOf={actorNameOf}
          />
        ))}
      </ol>
    </section>
  )
}

export default RegistrationTimeline
