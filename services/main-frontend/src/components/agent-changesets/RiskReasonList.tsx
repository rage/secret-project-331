"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import type { RiskReason } from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"

interface RiskReasonCopy {
  change: string
  consequence: string
}

/** Teacher-facing wording per risk rule; the server's own text is written for agents. */
function riskReasonCopy(reason: RiskReason, t: TFunction): RiskReasonCopy {
  switch (reason.code) {
    case "exercise_with_submissions_removed":
      return {
        change: t("agent-risk-exercise-with-submissions-removed"),
        consequence: t("agent-risk-exercise-with-submissions-removed-consequence"),
      }
    case "page_with_submissions_removed":
      return {
        change: t("agent-risk-page-with-submissions-removed"),
        consequence: t("agent-risk-page-with-submissions-removed-consequence"),
      }
    case "chapter_with_submissions_removed":
      return {
        change: t("agent-risk-chapter-with-submissions-removed"),
        consequence: t("agent-risk-chapter-with-submissions-removed-consequence"),
      }
    case "visible_page_removed":
      return {
        change: t("agent-risk-visible-page-removed"),
        consequence: t("agent-risk-visible-page-removed-consequence"),
      }
    case "open_chapter_removed":
      return {
        change: t("agent-risk-open-chapter-removed"),
        consequence: t("agent-risk-open-chapter-removed-consequence"),
      }
    case "deadline_moved_earlier":
      return {
        change: t("agent-risk-deadline-moved-earlier"),
        consequence: t("agent-risk-deadline-moved-earlier-consequence"),
      }
    case "deadline_added_to_open_chapter":
      return {
        change: t("agent-risk-deadline-added-to-open-chapter"),
        consequence: t("agent-risk-deadline-added-to-open-chapter-consequence"),
      }
    case "opening_moved_later":
      return {
        change: t("agent-risk-opening-moved-later"),
        consequence: t("agent-risk-opening-moved-later-consequence"),
      }
    case "completion_policy_changed_after_completions":
      return {
        change: t("agent-risk-completion-policy-changed"),
        consequence: t("agent-risk-completion-policy-changed-consequence"),
      }
    case "completion_requirement_changed_after_completions":
      return {
        change: t("agent-risk-completion-requirement-changed"),
        consequence: t("agent-risk-completion-requirement-changed-consequence"),
      }
    case "chapter_locking_toggled":
      return {
        change: t("agent-risk-chapter-locking-toggled"),
        consequence: t("agent-risk-chapter-locking-toggled-consequence"),
      }
    default:
      return { change: reason.message, consequence: reason.consequence }
  }
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
            key={`${reason.code}-${reason.message}`}
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
