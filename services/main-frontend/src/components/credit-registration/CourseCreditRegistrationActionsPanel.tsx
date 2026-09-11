"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationActionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseCreditRegistrationAction,
  CreditRegistrationAdminAction,
} from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import { formatUserName } from "@/hooks/useUserDetails"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure, Link, QueryResult, RelativeTime } from "@/shared-module/components"

import {
  BADGE_COMPACT,
  CREDIT_REGISTRATION_NS,
  MIDDLE_DOT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "./constants"
import CreditRegistrationByIdDialog from "./CreditRegistrationByIdDialog"
import { actionSentence, TEACHER_ACTOR_ROLE } from "./creditRegistrationRetry"
import {
  dividedListCss,
  headingCss,
  noteCss,
  rowCss,
  sectionHeaderCss,
  statusTriggerCss,
} from "./styles"

interface Props {
  courseId: string
}

/** What was done in the last hour or two answers "has this already been retried"; the rest is history. */
const ALWAYS_SHOWN_ACTIONS = 3

/**
 * Actions on the pipeline itself, which a course teacher can neither cause nor undo and whose
 * words ("phase") name nothing they can see.
 */
const PIPELINE_ACTIONS: readonly CreditRegistrationAdminAction[] = [
  "pause_phase",
  "resume_phase",
  "run_phase_now",
]

const REGISTRATION_TARGET = "credit_registration" as const
const COURSE_MODULE_TARGET = "course_module" as const

const listSectionCss = css`
  display: grid;
  gap: var(--space-3);
`

const entryCss = css`
  display: grid;
  gap: var(--space-1);
`

/**
 * What the action was done to, as the way to get to it.
 *
 * An entry saying only "Marked resolved" is unusable: a teacher's question is which of their
 * students it was about.
 */
const ActionTarget: React.FC<{ courseId: string; action: CourseCreditRegistrationAction }> = ({
  courseId,
  action,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [isOpen, setIsOpen] = useState(false)
  const structureQuery = useCourseStructure(courseId)

  if (!action.target_id) {
    return null
  }
  if (action.target_kind === REGISTRATION_TARGET) {
    return (
      <>
        <button type="button" className={statusTriggerCss} onClick={() => setIsOpen(true)}>
          <span>{t("credit-registration-show-the-registration")}</span>
        </button>
        {isOpen && (
          <CreditRegistrationByIdDialog
            creditRegistrationId={action.target_id}
            onClose={() => setIsOpen(false)}
          />
        )}
      </>
    )
  }
  if (action.target_kind === COURSE_MODULE_TARGET) {
    const moduleName = structureQuery.data?.modules.find(
      (module) => module.id === action.target_id,
    )?.name
    return (
      <Link href={manageCourseModulesRoute(courseId)}>{moduleName ?? t("default-module")}</Link>
    )
  }
  return null
}

const ActionEntry: React.FC<{ courseId: string; action: CourseCreditRegistrationAction }> = ({
  courseId,
  action,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const actorName =
    formatUserName({
      first_name: action.actor_first_name,
      last_name: action.actor_last_name,
    }) || t("reset-by-unknown-user")

  return (
    <div className={entryCss}>
      <span className={rowCss}>
        <span>{actionSentence(t, action.action, action.affected_row_count)}</span>
        <ActionTarget courseId={courseId} action={action} />
      </span>
      <span className={noteCss}>
        {actorName}
        {action.actor_role !== TEACHER_ACTOR_ROLE && (
          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
            {t("credit-registration-action-by-support")}
          </Badge>
        )}
        {MIDDLE_DOT}
        <RelativeTime at={action.created_at} absoluteTime={TIME_COMPACT} />
      </span>
      {action.reason && <span className={noteCss}>{action.reason}</span>}
    </div>
  )
}

/** Who has already acted on this course's registrations, newest first. */
const CourseCreditRegistrationActionsPanel: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const actionsQuery = useQuery(
    getCourseCreditRegistrationActionsOptions({ path: { course_id: courseId } }),
  )

  return (
    <QueryResult query={actionsQuery} refreshIndicator={QUIET_REFRESH}>
      {(allActions) => {
        const actions = allActions.filter((action) => !PIPELINE_ACTIONS.includes(action.action))
        if (actions.length === 0) {
          return null
        }
        const recent = actions.slice(0, ALWAYS_SHOWN_ACTIONS)
        const older = actions.slice(ALWAYS_SHOWN_ACTIONS)
        return (
          <div className={listSectionCss}>
            <div className={sectionHeaderCss}>
              <h3 className={headingCss}>{t("heading-credit-registration-recent-actions")}</h3>
              <p className={noteCss}>{t("credit-registration-recent-actions-hint")}</p>
            </div>
            <ul className={dividedListCss}>
              {recent.map((action) => (
                <li key={action.id}>
                  <ActionEntry courseId={courseId} action={action} />
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
                      <ActionEntry courseId={courseId} action={action} />
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
