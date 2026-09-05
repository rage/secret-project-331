"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationActionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { Badge, QueryResult, RelativeTime, Table } from "@/shared-module/components"

import { ABSENT, ALIGN_END, QUIET_REFRESH, TIME_IN_TITLE, TONE } from "./constants"
import { actionLabel, TEACHER_ACTOR_ROLE } from "./creditRegistrationRetry"
import { noteCss, rowCss, stackedCellCss, subheadingCss, subsectionCss } from "./styles"

interface Props {
  courseId: string
}

/** A colleague's last handful of actions is what stops two teachers retrying the same rows. */
const SHOWN_ACTIONS = 10

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
        return (
          <div className={subsectionCss}>
            <h3 className={subheadingCss}>{t("heading-credit-registration-recent-actions")}</h3>
            <p className={noteCss}>{t("credit-registration-recent-actions-hint")}</p>
            <Table
              caption={t("heading-credit-registration-recent-actions")}
              rowKey={(action) => action.id}
              rows={actions.slice(0, SHOWN_ACTIONS)}
              columns={[
                {
                  header: t("label-when"),
                  cell: (action) => (
                    <RelativeTime at={action.created_at} absoluteTime={TIME_IN_TITLE} />
                  ),
                },
                {
                  header: t("label-who"),
                  cell: (action) => (
                    <span className={rowCss}>
                      <span>
                        {formatUserName({
                          first_name: action.actor_first_name,
                          last_name: action.actor_last_name,
                        }) || t("reset-by-unknown-user")}
                      </span>
                      {action.actor_role !== TEACHER_ACTOR_ROLE && (
                        <Badge tone={TONE.NEUTRAL}>
                          {t("credit-registration-action-by-support")}
                        </Badge>
                      )}
                    </span>
                  ),
                },
                {
                  header: t("label-what-happened"),
                  cell: (action) => (
                    <span className={stackedCellCss}>
                      <span>{actionLabel(t, action.action)}</span>
                      {action.reason && <span className={noteCss}>{action.reason}</span>}
                    </span>
                  ),
                },
                {
                  header: t("label-count"),
                  align: ALIGN_END,
                  cell: (action) => action.affected_row_count ?? ABSENT,
                },
              ]}
            />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default CourseCreditRegistrationActionsPanel
