"use client"

import { css } from "@emotion/css"
import type { TFunction, TOptions } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import type { RiskReason } from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"

interface RiskReasonCopy {
  change: string
  consequence: string
}

/** What the reason found, formatted for its copy to interpolate. */
function riskReasonFacts(reason: RiskReason, t: TFunction): TOptions {
  switch (reason.code) {
    case "deadline_moved_earlier":
    case "exercise_deadline_moved_earlier":
      return { before: dateToString(reason.before), after: dateToString(reason.after) }
    case "deadline_added_to_open_chapter":
    case "exercise_deadline_added":
      return { deadline: dateToString(reason.deadline) }
    case "opening_moved_later":
      return { opensAt: dateToString(reason.opens_at) }
    case "chapter_locking_toggled":
      return { state: reason.is_enabled ? t("agent-switched-on") : t("agent-switched-off") }
    default:
      return {}
  }
}

/** Teacher-facing wording per risk rule; the server sends the facts only. */
function riskReasonCopy(reason: RiskReason, t: TFunction): RiskReasonCopy {
  const facts = riskReasonFacts(reason, t)
  const copies: Record<RiskReason["code"], RiskReasonCopy> = {
    exercise_with_submissions_removed: {
      change: t("agent-risk-exercise-with-submissions-removed"),
      consequence: t("agent-risk-exercise-with-submissions-removed-consequence"),
    },
    page_with_submissions_removed: {
      change: t("agent-risk-page-with-submissions-removed"),
      consequence: t("agent-risk-page-with-submissions-removed-consequence"),
    },
    chapter_with_submissions_removed: {
      change: t("agent-risk-chapter-with-submissions-removed"),
      consequence: t("agent-risk-chapter-with-submissions-removed-consequence"),
    },
    visible_page_removed: {
      change: t("agent-risk-visible-page-removed"),
      consequence: t("agent-risk-visible-page-removed-consequence"),
    },
    open_chapter_removed: {
      change: t("agent-risk-open-chapter-removed"),
      consequence: t("agent-risk-open-chapter-removed-consequence"),
    },
    deadline_moved_earlier: {
      change: t("agent-risk-deadline-moved-earlier", facts),
      consequence: t("agent-risk-deadline-moved-earlier-consequence"),
    },
    deadline_added_to_open_chapter: {
      change: t("agent-risk-deadline-added-to-open-chapter", facts),
      consequence: t("agent-risk-deadline-added-to-open-chapter-consequence"),
    },
    exercise_deadline_moved_earlier: {
      change: t("agent-risk-exercise-deadline-moved-earlier", facts),
      consequence: t("agent-risk-exercise-deadline-moved-earlier-consequence"),
    },
    exercise_deadline_added: {
      change: t("agent-risk-exercise-deadline-added", facts),
      consequence: t("agent-risk-exercise-deadline-added-consequence"),
    },
    opening_moved_later: {
      change: t("agent-risk-opening-moved-later", facts),
      consequence: t("agent-risk-opening-moved-later-consequence"),
    },
    completion_policy_changed_after_completions: {
      change: t("agent-risk-completion-policy-changed"),
      consequence: t("agent-risk-completion-policy-changed-consequence"),
    },
    completion_requirement_changed_after_completions: {
      change: t("agent-risk-completion-requirement-changed"),
      consequence: t("agent-risk-completion-requirement-changed-consequence"),
    },
    chapter_locking_toggled: {
      change: t("agent-risk-chapter-locking-toggled", facts),
      consequence: t("agent-risk-chapter-locking-toggled-consequence"),
    },
  }
  return copies[reason.code]
}

interface RiskReasonListProps {
  reasons: RiskReason[]
}

/** Why a staged change affects students, and what happens to them if it is published. */
const RiskReasonList: React.FC<RiskReasonListProps> = ({ reasons }) => {
  const { t } = useTranslation()
  return (
    <ul
      data-testid="agent-risk-reasons"
      className={css`
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      `}
    >
      {reasons.map((reason) => {
        const copy = riskReasonCopy(reason, t)
        return (
          <li
            key={JSON.stringify(reason)}
            className={css`
              border-left: 3px solid ${baseTheme.colors.yellow[600]};
              padding-left: 0.75rem;
            `}
          >
            <div
              className={css`
                font-weight: ${fontWeights.semibold};
                color: ${baseTheme.colors.gray[700]};
              `}
            >
              {copy.change}
            </div>
            <div
              className={css`
                color: ${baseTheme.colors.gray[600]};
              `}
            >
              {t("agent-risk-what-happens", { consequence: copy.consequence })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default RiskReasonList
