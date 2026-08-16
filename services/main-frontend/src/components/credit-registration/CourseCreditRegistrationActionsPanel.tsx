"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationActionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { Badge, QueryResult } from "@/shared-module/components"

import { TONE } from "./constants"
import { actionLabel, TEACHER_ACTOR_ROLE } from "./creditRegistrationRetry"
import { headingCss, noteCss, sectionCss } from "./styles"

interface Props {
  courseId: string
}

/** A colleague's last handful of actions is what stops two teachers retrying the same rows. */
const SHOWN_ACTIONS = 10

const listCss = css`
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.875rem;
`

const timestampCss = css`
  color: var(--color-gray-500);
  font-variant-numeric: tabular-nums;
`

const CourseCreditRegistrationActionsPanel: React.FC<Props> = ({ courseId }) => {
  const { t, i18n } = useTranslation()
  const actionsQuery = useQuery(
    getCourseCreditRegistrationActionsOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={actionsQuery}>
      {(actions) => {
        if (actions.length === 0) {
          return null
        }
        return (
          <section className={sectionCss}>
            <h3 className={headingCss}>{t("heading-credit-registration-recent-actions")}</h3>
            <p className={noteCss}>{t("credit-registration-recent-actions-hint")}</p>
            <ul className={listCss}>
              {actions.slice(0, SHOWN_ACTIONS).map((action) => (
                <li className={rowCss} key={action.id}>
                  <span className={timestampCss}>
                    {new Date(action.created_at).toLocaleString(i18n.language)}
                  </span>
                  <span>
                    {t("credit-registration-action-by", {
                      name:
                        [action.actor_first_name, action.actor_last_name]
                          .filter(Boolean)
                          .join(" ") || t("reset-by-unknown-user"),
                      action: actionLabel(t, action.action),
                    })}
                  </span>
                  {action.actor_role !== TEACHER_ACTOR_ROLE && (
                    <Badge tone={TONE.NEUTRAL}>{t("credit-registration-action-by-support")}</Badge>
                  )}
                  {action.affected_row_count !== null &&
                    action.affected_row_count !== undefined && (
                      <span className={timestampCss}>
                        {t("credit-registration-action-affected-rows", {
                          count: action.affected_row_count,
                        })}
                      </span>
                    )}
                  {action.reason && <span>{action.reason}</span>}
                </li>
              ))}
            </ul>
          </section>
        )
      }}
    </QueryResult>
  )
}

export default CourseCreditRegistrationActionsPanel
