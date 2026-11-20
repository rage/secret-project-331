"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { attentionReasonLabel } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { TONE_INK } from "@/components/credit-registration/admin/AdminStateLabel"
import LinkingMethodLabel from "@/components/credit-registration/admin/LinkingMethodLabel"
import {
  ATTENTION_STEPS,
  timelineStepLabel,
} from "@/components/credit-registration/admin/timelineSteps"
import {
  BADGE_COMPACT,
  CREDIT_REGISTRATION_NS,
  TONE,
} from "@/components/credit-registration/constants"
import InlineParts from "@/components/credit-registration/InlineParts"
import { codeValueCss, noteCss, stackedCellCss } from "@/components/credit-registration/styles"
import type { AdminCreditRegistrationRow } from "@/generated/api/types.generated"
import { Badge } from "@/shared-module/components"

const ATTENTION_ICON_SIZE = 14

const attentionLineCss = css`
  display: inline-flex;
  gap: var(--space-2);
  align-items: flex-start;
`

/** Centred on the first line of a label that may wrap. */
const attentionIconCss = css`
  flex: none;
  margin-top: 0.2em;
`

const numberLineCss = css`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
`

const stepCss = css`
  font-weight: 500;
`

/** The step in the timeline's words, and under it why the row needs a person, if it does. */
export const RegistrationStatusCell: React.FC<{ row: AdminCreditRegistrationRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const needsAttention = row.attention_standing === "needs_attention"
  const isAttention = !row.superseded && (needsAttention || ATTENTION_STEPS.has(row.timeline_step))
  const reason = needsAttention ? row.attention_reasons[0] : undefined
  return (
    <span className={stackedCellCss}>
      <span className={cx(stepCss, attentionLineCss)}>
        {isAttention && (
          <ExclamationTriangle
            size={ATTENTION_ICON_SIZE}
            className={cx(TONE_INK["action-needed"], attentionIconCss)}
            aria-hidden
          />
        )}
        {timelineStepLabel(t, row.timeline_step)}
      </span>
      <InlineParts
        className={noteCss}
        parts={[
          reason && attentionReasonLabel(t, reason),
          row.attention_standing === "running_late" && t("credit-registration-admin-running-late"),
          row.superseded && (
            <Badge key="replaced" tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
              {t("credit-registration-admin-replaced")}
            </Badge>
          ),
        ]}
      />
    </span>
  )
}

/** The account's linked student number, or the one sent, or a note that there is none. */
export const RegistrationStudentNumberCell: React.FC<{ row: AdminCreditRegistrationRow }> = ({
  row,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const number = row.verified_student_number ?? row.student_number
  if (!number) {
    return <span className={noteCss}>{t("credit-registration-admin-not-linked")}</span>
  }
  return (
    <span className={numberLineCss}>
      <span className={codeValueCss}>{number}</span>
      {row.verified_student_number_via && (
        <LinkingMethodLabel
          iconOnly
          method={row.verified_student_number_via}
          linkedAt={row.verified_student_number_at}
        />
      )}
    </span>
  )
}
