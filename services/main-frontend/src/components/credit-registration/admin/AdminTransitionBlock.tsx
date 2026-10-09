"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getCreditRegistrationAttentionItemsQueryKey,
  getCreditRegistrationForAdminQueryKey,
  getCreditRegistrationOverviewQueryKey,
  listCreditRegistrationAdminActionsQueryKey,
  listCreditRegistrationsForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminTransitionCreditRegistration } from "@/generated/api/sdk.generated"
import type {
  AdminCreditRegistrationRow,
  AdminTransitionCreditRegistrationResult,
  CheckNowTarget,
  ResubmissionRisk,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import type { ButtonVariant } from "@/shared-module/components"
import { Button, Checkbox, Infobox, Link } from "@/shared-module/components"

import {
  BUTTON_DESTRUCTIVE,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  TONE,
} from "../constants"
import { failureActionLabel } from "../registrationFailures"
import { refusalSentence } from "../resubmissionRefusal"
import { noteCss, proseCss, subsectionCss } from "../styles"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { AdminActionDialog } from "./AdminActionDialog"
import type { DialogOpenState } from "./AdminActionDialog"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminResendLinkingEmailButton from "./AdminResendLinkingEmailButton"
import type { HandActionOffer } from "./handActionOffers"
import { CHECK_NOW_OFFER, handActionOffers, renderableRemedies, RESUBMIT } from "./handActionOffers"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
  transitionAction,
} from "./TransitionTargetSelect"

interface Props {
  registration: AdminCreditRegistrationRow
  /**
   * Buttons in one row with housekeeping ones set apart on the right, for a box that already says
   * what is wrong.
   */
  isCompact?: boolean
}

interface Fields {
  action: TransitionChoice
  reason: string
  riskUnderstood: boolean
}

const APPLIED = "applied" as const
const REFUSED = "refused" as const
const RISK_FIELD = "riskUnderstood" as const

/**
 * Button on the left, what it does on the right, from `md` up; stacked below that. One grid holds
 * both groups and each row is a subgrid, so every explanation starts on one edge whatever its
 * button's width.
 */
const actionListCss = css`
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;

  ${respondToOrLarger.md} {
    grid-template-columns: fit-content(18rem) minmax(0, 1fr);
    column-gap: var(--space-5);
  }
`

/** Only `row-gap`: a subgrid's own column gap would replace the list's. */
const actionRowCss = css`
  display: grid;
  row-gap: var(--space-2);
  align-items: start;

  ${respondToOrLarger.md} {
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    /* Lines the explanation's first line up with the button's label. */
    align-items: baseline;
  }
`

const housekeepingStartCss = css`
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-clear-300);
`

const compactCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
`

/** Pushed to the far end: neither dismissing nor cancelling moves the registration forward. */
const compactHousekeepingCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-left: auto;
`

const explanationCss = css`
  display: grid;
  gap: var(--space-1);

  > p {
    margin: 0;
  }
`

export const CHECK_NOW_COPY = {
  attainment: {
    label: "credit-registration-admin-target-check-attainment",
    description: "credit-registration-admin-check-attainment-description",
  },
  enrolment: {
    label: "credit-registration-admin-target-check-enrolment",
    description: "credit-registration-admin-check-enrolment-description",
  },
  next_attempt: {
    label: "credit-registration-admin-target-check-next-attempt",
    description: "credit-registration-admin-check-next-attempt-description",
  },
} as const satisfies Record<CheckNowTarget, { label: string; description: string }>

/** What a resend dialog says and asks beyond the reason, per how the resend may go wrong. */
const RISK_COPY = {
  normal: null,
  likely_rejected_again: {
    tone: TONE.WARNING,
    warning: "credit-registration-admin-resubmit-repeat-warning",
    confirm: "credit-registration-admin-resubmit-repeat-confirm",
  },
  replaces_reversed_attainment: {
    tone: TONE.INFO,
    warning: "credit-registration-admin-resubmit-reversed-note",
    confirm: null,
  },
  possible_duplicate: {
    tone: TONE.DANGER,
    warning: "credit-registration-admin-resubmit-duplicate-warning",
    confirm: "credit-registration-admin-resubmit-duplicate-confirm",
  },
} as const satisfies Record<
  ResubmissionRisk,
  { tone: string; warning: string; confirm: string | null } | null
>

export interface ActionResult {
  isApplied: boolean
  message: string
}

interface TransitionActionProps {
  registrationId: string
  choice: TransitionChoice
  label: string
  /** What the action does, as the list shows it beside the button; also the dialog's body. */
  explanation: React.ReactNode
  appliedMessage: string
  triggerVariant: ButtonVariant
  risk?: ResubmissionRisk
  isDestructive?: boolean
  onResult: (result: ActionResult) => void
  openState?: DialogOpenState
}

/** One hand transition on one registration: its button, and the reason dialog it opens. */
export const TransitionAction: React.FC<TransitionActionProps> = ({
  registrationId,
  choice,
  label,
  explanation,
  appliedMessage,
  triggerVariant,
  risk = "normal",
  isDestructive = false,
  onResult,
  openState,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const queryClient = useQueryClient()
  const riskCopy = RISK_COPY[risk]

  return (
    <AdminActionDialog<Fields, AdminTransitionCreditRegistrationResult>
      triggerLabel={label}
      triggerVariant={triggerVariant}
      {...includeIf(openState, { openState })}
      dialogTitle={label}
      description={explanation}
      confirmLabel={label}
      isDestructive={isDestructive || risk === "possible_duplicate"}
      defaultValues={{ action: choice, reason: "", riskUnderstood: false }}
      mutationFn={(fields) =>
        adminTransitionCreditRegistration({
          path: { credit_registration_id: registrationId },
          body: { action: transitionAction(fields.action), reason: fields.reason },
        })
      }
      onSuccess={(result) => {
        onResult({
          isApplied: result.outcome === APPLIED,
          message: result.outcome === REFUSED ? refusalSentence(t, result.refusal) : appliedMessage,
        })
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationForAdminQueryKey({
              path: { credit_registration_id: registrationId },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationAttentionItemsQueryKey(),
          }),
          queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
          // The action log on this very page, which the transition has just written a row to.
          queryClient.invalidateQueries({
            queryKey: listCreditRegistrationAdminActionsQueryKey(),
          }),
        ])
      }}
      renderFields={(control: Control<Fields>) => (
        <>
          {riskCopy && <Infobox tone={riskCopy.tone}>{t(riskCopy.warning)}</Infobox>}
          {riskCopy?.confirm && (
            <Checkbox
              name={RISK_FIELD}
              control={control}
              rules={{ required: t("required-field") }}
              label={t(riskCopy.confirm)}
            />
          )}
          <ReasonField control={control} />
        </>
      )}
    />
  )
}

const prose = (text: React.ReactNode) => <p className={proseCss}>{text}</p>

const ActionRow: React.FC<{
  control: React.ReactNode
  explanation: React.ReactNode
  className?: string | undefined
}> = ({ control, explanation, className }) => {
  const isCompact = React.useContext(CompactContext)
  return isCompact ? (
    control
  ) : (
    <li className={cx(actionRowCss, className)}>
      <div>{control}</div>
      <div className={explanationCss}>{explanation}</div>
    </li>
  )
}

const CompactContext = React.createContext(false)

/**
 * The hand actions an admin has on one row, each beside what it does, led by the one that could
 * fix this failure. Dismissing the flag and cancelling come last, under a rule: neither is a
 * remedy, and cancelling is the only action that ends the registration.
 */
const AdminTransitionBlock: React.FC<Props> = ({ registration, isCompact = false }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  // Kept here rather than under its button: an applied action usually changes which actions the
  // row is offered, taking its own button with it.
  const [lastResult, setLastResult] = useState<ActionResult | null>(null)

  if (registration.superseded) {
    return <p className={noteCss}>{t("credit-registration-admin-superseded-no-actions")}</p>
  }

  const { resubmission } = registration.hand_actions
  const checkNow = registration.hand_actions.check_now ?? null
  const cancelRefusal = registration.hand_actions.cancel_refusal ?? null
  const studentNumber = registration.verified_student_number ?? registration.student_number
  const { offers, recommended } = handActionOffers(
    registration,
    renderableRemedies({
      hasEmail: Boolean(registration.email),
      hasStudentNumber: Boolean(studentNumber),
      isAccountLinkingEnabled,
    }),
  )
  const variantFor = (offer: HandActionOffer): ButtonVariant =>
    offer === recommended ? BUTTON_PRIMARY : BUTTON_SECONDARY

  const renderOffer = (offer: HandActionOffer): React.ReactNode => {
    switch (offer) {
      case RESUBMIT: {
        if (resubmission.kind !== "allowed") {
          return null
        }
        const riskCopy = RISK_COPY[resubmission.risk]
        const explanation = (
          <>
            {prose(t("credit-registration-admin-resubmit-description"))}
            {riskCopy && <p className={noteCss}>{t(riskCopy.warning)}</p>}
          </>
        )
        return (
          <ActionRow
            key={offer}
            control={
              <TransitionAction
                registrationId={registration.id}
                choice={READY_TO_SUBMIT}
                label={t("credit-registration-admin-target-resubmit")}
                explanation={explanation}
                appliedMessage={t("credit-registration-admin-resubmit-applied")}
                triggerVariant={variantFor(offer)}
                risk={resubmission.risk}
                onResult={setLastResult}
              />
            }
            explanation={explanation}
          />
        )
      }
      case CHECK_NOW_OFFER: {
        if (checkNow === null) {
          return null
        }
        const copy = CHECK_NOW_COPY[checkNow]
        const explanation = prose(t(copy.description))
        return (
          <ActionRow
            key={offer}
            control={
              <TransitionAction
                registrationId={registration.id}
                choice={CHECK_NOW}
                label={t(copy.label)}
                explanation={explanation}
                appliedMessage={t("credit-registration-admin-check-now-applied")}
                triggerVariant={variantFor(offer)}
                onResult={setLastResult}
              />
            }
            explanation={explanation}
          />
        )
      }
      case "fix_module_configuration":
        return (
          <ActionRow
            key={offer}
            control={
              <Link
                href={manageCourseModulesRoute(registration.course_id)}
                styledAsButton
                variant={variantFor(offer)}
                size="medium"
              >
                {failureActionLabel(t, offer)}
              </Link>
            }
            explanation={prose(t("credit-registration-admin-fix-module-configuration-description"))}
          />
        )
      case "email_student":
        return (
          <ActionRow
            key={offer}
            control={
              <Link
                href={`mailto:${registration.email}`}
                styledAsButton
                variant={variantFor(offer)}
                size="medium"
              >
                {failureActionLabel(t, offer)}
              </Link>
            }
            explanation={prose(
              t("credit-registration-admin-email-student-description", {
                email: registration.email,
              }),
            )}
          />
        )
      case "link_student_number_by_hand":
        return studentNumber ? (
          <ActionRow
            key={offer}
            control={
              <AdminManualLinkButton
                studentNumber={studentNumber}
                account={{
                  userId: registration.user_id,
                  name: formatUserName(registration),
                  email: registration.email ?? null,
                }}
                label={failureActionLabel(t, offer)}
                variant={variantFor(offer)}
              />
            }
            explanation={prose(t("credit-registration-admin-manual-link-description"))}
          />
        ) : null
      case "resend_student_number_link":
        return studentNumber ? (
          <ActionRow
            key={offer}
            control={
              <AdminResendLinkingEmailButton
                studentNumber={studentNumber}
                courseId={registration.course_id}
                courseName={registration.course_name}
                variant={variantFor(offer)}
              />
            }
            explanation={prose(t("credit-registration-admin-resend-link-description"))}
          />
        ) : null
    }
  }

  const rows = offers.map((offer) => renderOffer(offer))
  // A resend held back only until a known time is worth showing as such: waiting is the remedy.
  const resubmitWaitNote =
    resubmission.kind === "refused" && resubmission.available_at
      ? t("credit-registration-admin-resubmit-available-at", {
          time: formatZonedTimestamp(new Date(resubmission.available_at)),
        })
      : null
  if (resubmitWaitNote !== null) {
    rows.push(
      <ActionRow
        key={RESUBMIT}
        control={
          <Button variant={BUTTON_SECONDARY} size="medium" disabled>
            {t("credit-registration-admin-target-resubmit")}
          </Button>
        }
        explanation={prose(resubmitWaitNote)}
      />,
    )
  }

  const cancelExplanation = (
    <>
      {prose(t("credit-registration-admin-cancel-description"))}
      <p className={noteCss}>
        {registration.submitted_at
          ? t("credit-registration-admin-cancel-sent-note")
          : t("credit-registration-admin-cancel-unsent-note")}
      </p>
    </>
  )
  const clearAttentionExplanation = prose(
    t("credit-registration-admin-clear-attention-description"),
  )
  const remedies = rows.filter((row) => row !== null)
  // The rule between the groups sits on the first housekeeping row, so the list holds only actions.
  const housekeepingStart = remedies.length > 0 ? housekeepingStartCss : undefined
  const housekeeping: React.ReactNode[] = []
  if (registration.needs_admin_attention) {
    housekeeping.push(
      <ActionRow
        key={CLEAR_ATTENTION}
        className={housekeepingStart}
        control={
          <TransitionAction
            registrationId={registration.id}
            choice={CLEAR_ATTENTION}
            label={t("credit-registration-admin-target-clear-attention")}
            explanation={clearAttentionExplanation}
            appliedMessage={t("credit-registration-admin-attention-cleared")}
            triggerVariant={BUTTON_TERTIARY}
            onResult={setLastResult}
          />
        }
        explanation={clearAttentionExplanation}
      />,
    )
  }
  if (cancelRefusal === null) {
    housekeeping.push(
      <ActionRow
        key={CANCELLED}
        className={housekeeping.length === 0 ? housekeepingStart : undefined}
        control={
          <TransitionAction
            registrationId={registration.id}
            choice={CANCELLED}
            label={t("credit-registration-admin-target-cancel")}
            explanation={cancelExplanation}
            appliedMessage={t("credit-registration-admin-cancel-applied")}
            triggerVariant={isCompact ? BUTTON_DESTRUCTIVE : BUTTON_TERTIARY}
            isDestructive
            onResult={setLastResult}
          />
        }
        explanation={cancelExplanation}
      />,
    )
  }

  const hasActions = remedies.length > 0 || housekeeping.length > 0
  const noActionsNote = !hasActions && (
    <p className={noteCss}>{t("credit-registration-admin-actions-none")}</p>
  )

  if (isCompact) {
    return (
      <CompactContext.Provider value>
        <div className={subsectionCss}>
          {lastResult && (
            <Infobox tone={lastResult.isApplied ? TONE.INFO : TONE.WARNING}>
              {lastResult.message}
            </Infobox>
          )}
          {noActionsNote}
          {hasActions && (
            <div className={compactCss}>
              {remedies}
              {housekeeping.length > 0 && (
                <span className={compactHousekeepingCss}>{housekeeping}</span>
              )}
            </div>
          )}
          {resubmitWaitNote !== null && <p className={noteCss}>{resubmitWaitNote}</p>}
        </div>
      </CompactContext.Provider>
    )
  }

  return (
    <div className={subsectionCss}>
      {lastResult && (
        <Infobox tone={lastResult.isApplied ? TONE.INFO : TONE.WARNING}>
          {lastResult.message}
        </Infobox>
      )}
      {noActionsNote}
      {hasActions && (
        <ul className={actionListCss}>
          {remedies}
          {housekeeping}
        </ul>
      )}
    </div>
  )
}

export default AdminTransitionBlock
