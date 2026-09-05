"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationActionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistrationAction } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { Badge, Disclosure, QueryResult, RelativeTime } from "@/shared-module/components"

import {
  BADGE_COMPACT,
  MIDDLE_DOT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "./constants"
import { actionSentence, TEACHER_ACTOR_ROLE } from "./creditRegistrationRetry"
import { dividedListCss, noteCss, rowCss, sectionHeaderCss, subheadingCss } from "./styles"

interface Props {
  courseId: string
}

/** What was done in the last hour or two answers "has this already been retried"; the rest is history. */
const ALWAYS_SHOWN_ACTIONS = 3

const listSectionCss = css`
  display: grid;
  gap: var(--space-3);
`

const entryCss = css`
  display: grid;
  gap: var(--space-1);
`

const ActionEntry: React.FC<{ action: CourseCreditRegistrationAction }> = ({ action }) => {
  const { t } = useTranslation()
  const actorName =
    formatUserName({
      first_name: action.actor_first_name,
      last_name: action.actor_last_name,
    }) || t("reset-by-unknown-user")

  return (
    <div className={entryCss}>
      <span className={rowCss}>
        <span>{actionSentence(t, action.action, action.affected_row_count)}</span>
        {action.actor_role !== TEACHER_ACTOR_ROLE && (
          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
            {t("credit-registration-action-by-support")}
          </Badge>
        )}
      </span>
      <span className={noteCss}>
        {actorName}
        {MIDDLE_DOT}
        <RelativeTime at={action.created_at} absoluteTime={TIME_COMPACT} />
      </span>
      {action.reason && <span className={noteCss}>{action.reason}</span>}
    </div>
  )
}

/** Who has already acted on this course's registrations, newest first. */
const CourseCreditRegistrationActionsPanel: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()
  const actionsQuery = useQuery(
    getCourseCreditRegistrationActionsOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={actionsQuery} refreshIndicator={QUIET_REFRESH}>
      {(actions) => {
        if (actions.length === 0) {
          return null
        }
        const recent = actions.slice(0, ALWAYS_SHOWN_ACTIONS)
        const older = actions.slice(ALWAYS_SHOWN_ACTIONS)
        return (
          <div className={listSectionCss}>
            <div className={sectionHeaderCss}>
              <h3 className={subheadingCss}>{t("heading-credit-registration-recent-actions")}</h3>
              <p className={noteCss}>{t("credit-registration-recent-actions-hint")}</p>
            </div>
            <ul className={dividedListCss}>
              {recent.map((action) => (
                <li key={action.id}>
                  <ActionEntry action={action} />
                </li>
              ))}
            </ul>
            {older.length > 0 && (
              <Disclosure
                variant={PLAIN_DISCLOSURE}
                title={t("credit-registration-older-actions", { count: older.length })}
              >
                <ul className={dividedListCss}>
                  {older.map((action) => (
                    <li key={action.id}>
                      <ActionEntry action={action} />
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </div>
        )
      }}
    </QueryResult>
  )
}

export default CourseCreditRegistrationActionsPanel
