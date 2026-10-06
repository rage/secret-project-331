"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { AdminCreditRegistrationEvent } from "@/generated/api/types.generated"
import type { RegistrationStatusState } from "@/shared-module/components"
import { Table } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, DENSITY_COMPACT, TABLE_STACK } from "../constants"
import { registrationLedgerStateLabel } from "../creditRegistrationCopy"
import { headingCss, noteCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { formatZonedTimeRange, ZonedTimestamp } from "../ZonedTimestamp"
import { TONE_INK } from "./AdminStateLabel"
import { buildTimeline } from "./timelineRows"
import type { TimelineEntry } from "./timelineRows"

const DOT_SIZE = "0.5rem"

/** A dot column before every sentence, so sentences line up whether or not their row has one. */
const eventCellCss = css`
  display: grid;
  grid-template-columns: ${DOT_SIZE} minmax(0, 1fr);
  column-gap: var(--space-2);
  align-items: baseline;
`

const dotCss = css`
  display: inline-block;
  width: ${DOT_SIZE};
  height: ${DOT_SIZE};
  border-radius: 50%;
  background-color: currentColor;
`

const detailCss = css`
  grid-column: 2;
  margin: 0;
`

/** Only a step that went wrong is marked; everything else reads as the routine it is. */
const isProblem = (tone: RegistrationStatusState): boolean =>
  tone === "action-needed" || tone === "failed"

const EventCell: React.FC<{ entry: TimelineEntry }> = ({ entry }) => (
  <div className={eventCellCss}>
    <span aria-hidden className={isProblem(entry.tone) ? TONE_INK[entry.tone] : undefined}>
      {isProblem(entry.tone) && <span className={dotCss} />}
    </span>
    <span>{entry.sentence}</span>
    {entry.detail && <p className={cx(noteCss, detailCss)}>{entry.detail}</p>}
  </div>
)

/** The registration's story in plain words, oldest first; the Suotar calls table has the detail. */
const RegistrationTimeline: React.FC<{
  events: AdminCreditRegistrationEvent[]
  actorNames: Map<string, string>
  selectedEnrolmentId: string | null
}> = ({ events, actorNames, selectedEnrolmentId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const entries = buildTimeline(t, events, {
    actorName: (userId) => actorNames.get(userId),
    selectedEnrolmentId,
  })
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-timeline")}</h2>
      </div>
      <Table
        caption={t("credit-registration-heading-timeline")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(entry) => entry.id}
        rows={entries}
        columns={[
          {
            header: t("label-time"),
            minWidth: "11rem",
            cell: (entry) => (
              <span className={noteCss}>
                {entry.until ? (
                  formatZonedTimeRange(new Date(entry.at), new Date(entry.until))
                ) : (
                  <ZonedTimestamp at={entry.at} />
                )}
              </span>
            ),
          },
          {
            header: t("credit-registration-admin-column-event"),
            grow: true,
            minWidth: "14rem",
            cell: (entry) => <EventCell entry={entry} />,
          },
          {
            header: t("label-state"),
            minWidth: "9rem",
            cell: (entry) => (entry.state ? registrationLedgerStateLabel(t, entry.state) : null),
          },
        ]}
      />
    </section>
  )
}

export default RegistrationTimeline
