"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { AdminCreditRegistrationEvent } from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import type { RegistrationStatusState } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import {
  dividedListCss,
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
} from "../styles"
import { formatZonedTimeRange, ZonedTimestamp } from "../ZonedTimestamp"
import { TONE_INK } from "./AdminStateLabel"
import { buildTimeline } from "./timelineRows"

const entryCss = css`
  display: grid;
  gap: var(--space-1) var(--space-4);
  grid-template-columns: minmax(0, 1fr);

  ${respondToOrLarger.md} {
    grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
  }
`

/** Upcoming and superseded ink is a faint gray meant for glyphs; as text it falls below contrast. */
const sentenceInk = (tone: RegistrationStatusState): string | undefined =>
  tone === "upcoming" || tone === "superseded" ? undefined : TONE_INK[tone]

/** The registration's story in plain words, oldest first; the Suotar calls table has the detail. */
const RegistrationTimeline: React.FC<{
  events: AdminCreditRegistrationEvent[]
  actorNames: Map<string, string>
}> = ({ events, actorNames }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const entries = buildTimeline(t, events, { actorName: (userId) => actorNames.get(userId) })
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-timeline")}</h2>
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role */}
      <ol className={dividedListCss} role="list">
        {entries.map((entry) => (
          <li key={entry.id} className={entryCss}>
            <span className={noteCss}>
              {entry.until ? (
                <span>{formatZonedTimeRange(new Date(entry.at), new Date(entry.until))}</span>
              ) : (
                <ZonedTimestamp at={entry.at} />
              )}
            </span>
            <span className={sentenceInk(entry.tone)}>{entry.sentence}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default RegistrationTimeline
