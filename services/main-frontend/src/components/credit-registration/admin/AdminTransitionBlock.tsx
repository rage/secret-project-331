"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCreditRegistrationForAdminQueryKey,
  getCreditRegistrationOverviewQueryKey,
  listCreditRegistrationsForAdminQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { adminTransitionCreditRegistration } from "@/generated/api/sdk.generated"
import type {
  AdminCreditRegistrationRow,
  AdminTransitionCreditRegistrationResult,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import type { ButtonVariant } from "@/shared-module/components"
import { Infobox, Link } from "@/shared-module/components"

import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_TERTIARY, TONE } from "../constants"
import type { FailureAction, FailureRemedy } from "../registrationFailures"
import {
  failureActionLabel,
  failureActions,
  failureOwnerHeading,
  failureRemedy,
} from "../registrationFailures"
import { refusalSentence } from "../resubmissionRefusal"
import { noteCss, proseCss, rowCss, subsectionCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminResendLinkingEmailButton from "./AdminResendLinkingEmailButton"
import { ReasonField } from "./ReasonConfirmDialog"
import type { TransitionChoice } from "./TransitionTargetSelect"
import {
  CANCELLED,
  CHECK_NOW,
  CLEAR_ATTENTION,
  READY_TO_SUBMIT,
  transitionAction,
} from "./TransitionTargetSelect"

interface TransitionCopy {
  label: string
  description: string
  appliedMessage: string
}

/** The label, the one-sentence description and the applied message for each transition target. */
const TRANSITION_COPY = {
  [READY_TO_SUBMIT]: {
    label: "credit-registration-admin-target-resubmit",
    description: "credit-registration-admin-resubmit-description",
    appliedMessage: "credit-registration-admin-resubmit-applied",
  },
  [CHECK_NOW]: {
    label: "credit-registration-admin-target-check-now",
    description: "credit-registration-admin-check-now-description",
    appliedMessage: "credit-registration-admin-check-now-applied",
  },
  [CLEAR_ATTENTION]: {
    label: "credit-registration-admin-target-clear-attention",
    description: "credit-registration-admin-clear-attention-description",
    appliedMessage: "credit-registration-admin-attention-cleared",
  },
  [CANCELLED]: {
    label: "credit-registration-admin-target-cancel",
    description: "credit-registration-admin-cancel-description",
    appliedMessage: "credit-registration-admin-cancel-applied",
  },
} as const satisfies Record<TransitionChoice, TransitionCopy>

interface Props {
  registration: AdminCreditRegistrationRow
}

interface Fields {
  action: TransitionChoice
  reason: string
}

const SUBMISSION_UNCERTAIN = "submission_uncertain"
const AWAITING_VERIFICATION = "awaiting_verification"
const ADMIN_AUDIENCE = "admin" as const
const RETRY = "retry" as const
const RECHECK_REGISTRY = "recheck_registry" as const

/** A row of same-height action buttons: a taller item must not lift its neighbours to its middle. */
const actionsRowCss = cx(
  rowCss,
  css`
    align-items: start;
  `,
)

/** Sets the row's one destructive action apart, on its own line rather than wherever it fits. */
const cancelRowCss = css`
  display: flex;
  justify-content: end;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-clear-300);
`

const APPLIED = "applied" as const
const REFUSED = "refused" as const

/** Why sending this row to Sisu again cannot clear its failure. Nothing for a remedy a resend is. */
const RETRY_BLOCKED_KEYS = {
  module_configuration: "credit-registration-admin-retry-blocked-configuration",
  student_number: "credit-registration-admin-retry-blocked-student-number",
  student_enrolment: "credit-registration-admin-retry-blocked-enrolment",
  recheck: "credit-registration-admin-retry-blocked-uncertain",
  support: "credit-registration-admin-retry-blocked-deterministic",
} as const satisfies Record<Exclude<FailureRemedy, typeof RETRY>, string>

interface TransitionActionProps {
  registration: AdminCreditRegistrationRow
  choice: TransitionChoice
  label: string
  /** One sentence saying what this action does to the row, shown before the reason field. */
  description: string
  appliedMessage: string
  triggerVariant?: ButtonVariant
  isDestructive?: boolean
}

const TransitionAction: React.FC<TransitionActionProps> = ({
  registration,
  choice,
  label,
  description,
  appliedMessage,
  triggerVariant,
  isDestructive = false,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return (
    <AdminActionDialog<Fields, AdminTransitionCreditRegistrationResult>
      triggerLabel={label}
      {...includeIf(triggerVariant, { triggerVariant })}
      dialogTitle={label}
      description={description}
      confirmLabel={label}
      isDestructive={isDestructive}
      defaultValues={{ action: choice, reason: "" }}
      mutationFn={(fields) =>
        adminTransitionCreditRegistration({
          path: { credit_registration_id: registration.id },
          body: { action: transitionAction(fields.action), reason: fields.reason },
        })
      }
      onSuccess={() => {
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: getCreditRegistrationForAdminQueryKey({
              path: { credit_registration_id: registration.id },
            }),
          }),
          queryClient.invalidateQueries({ queryKey: listCreditRegistrationsForAdminQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getCreditRegistrationOverviewQueryKey() }),
        ])
      }}
      renderFields={(control) => <ReasonField control={control} />}
      renderResult={(result) => (
        <Infobox tone={result.outcome === APPLIED ? TONE.INFO : TONE.WARNING}>
          {result.outcome === REFUSED ? refusalSentence(t, result.refusal) : appliedMessage}
        </Infobox>
      )}
    />
  )
}

/**
 * The remedies this row is offered, in the order they should be tried.
 *
 * The state decides it where it can: an unknown submission outcome has to be checked rather than
 * sent again, and a row Sisu has not answered yet has nothing to resend. Otherwise the failure's
 * own remedy plan does, so a resend is never the first thing offered for a failure it cannot clear.
 */
const offeredActions = (registration: AdminCreditRegistrationRow): readonly FailureAction[] => {
  if (registration.state === SUBMISSION_UNCERTAIN || registration.state === AWAITING_VERIFICATION) {
    return [RECHECK_REGISTRY]
  }
  const plan = failureActions(registration.error_code, ADMIN_AUDIENCE)
  return [plan.primary, ...plan.secondary].filter(
    (action): action is FailureAction => action !== null,
  )
}

/**
 * The hand actions an admin has on one row, led by the one that could fix this failure; a refused
 * one comes back saying why.
 *
 * Dismissing the flag and cancelling come last whatever the failure is: neither is a remedy, and
 * cancelling is the only action that ends the registration.
 */
const AdminTransitionBlock: React.FC<Props> = ({ registration }) => {
  const { t } = useTranslation()

  if (registration.superseded) {
    return <p className={noteCss}>{t("credit-registration-admin-superseded-no-actions")}</p>
  }

  // Non-null only where the study registry's answer is already in: a state move would be refused.
  const refusal = registration.resubmission_refusal ?? null
  const remedy = failureRemedy(registration.error_code)
  const owner = failureActions(registration.error_code, ADMIN_AUDIENCE).owner
  const studentNumber = registration.verified_student_number ?? registration.student_number
  const offered = offeredActions(registration).filter(
    (action) => refusal === null || action !== RETRY,
  )
  const retryBlockedReason =
    refusal === null && registration.error_code && remedy !== RETRY
      ? t(RETRY_BLOCKED_KEYS[remedy])
      : null

  const renderTransition = (choice: TransitionChoice, triggerVariant: ButtonVariant) => {
    const copy = TRANSITION_COPY[choice]
    return (
      <TransitionAction
        key={choice}
        registration={registration}
        choice={choice}
        label={t(copy.label)}
        description={t(copy.description)}
        appliedMessage={t(copy.appliedMessage)}
        triggerVariant={triggerVariant}
      />
    )
  }

  const renderAction = (action: FailureAction, isPrimary: boolean): React.ReactNode => {
    const buttonVariant = isPrimary ? BUTTON_PRIMARY : BUTTON_SECONDARY
    switch (action) {
      case "retry":
      case "recheck_registry":
        return renderTransition(action === "retry" ? READY_TO_SUBMIT : CHECK_NOW, buttonVariant)
      case "fix_module_configuration":
      case "email_student": {
        const href =
          action === "fix_module_configuration"
            ? manageCourseModulesRoute(registration.course_id)
            : registration.email && `mailto:${registration.email}`
        return href ? (
          <Link key={action} href={href} styledAsButton variant={buttonVariant} size="medium">
            {failureActionLabel(t, action)}
          </Link>
        ) : null
      }
      case "link_student_number_by_hand":
        return studentNumber ? (
          <AdminManualLinkButton
            key={action}
            studentNumber={studentNumber}
            account={{
              userId: registration.user_id,
              name: formatUserName(registration),
              email: registration.email ?? null,
            }}
            label={failureActionLabel(t, action)}
            variant={buttonVariant}
          />
        ) : null
      case "resend_student_number_link":
        return studentNumber ? (
          <AdminResendLinkingEmailButton
            key={action}
            studentNumber={studentNumber}
            courseId={registration.course_id}
            courseName={registration.course_name}
            variant={buttonVariant}
          />
        ) : null
      default:
        return null
    }
  }

  // An offered action can render nothing (no email address, no student number), so the buttons that
  // survived — not the plan — decide which one leads and whether only a sentence is left.
  const actions = offered.reduce<React.ReactNode[]>((rendered, action) => {
    const button = renderAction(action, rendered.length === 0)
    return button === null ? rendered : [...rendered, button]
  }, [])
  const dismissFlagAction = registration.needs_admin_attention
    ? renderTransition(CLEAR_ATTENTION, BUTTON_TERTIARY)
    : null

  return (
    <div className={subsectionCss}>
      {registration.state === SUBMISSION_UNCERTAIN && (
        <Infobox tone={TONE.WARNING}>{t("credit-registration-admin-uncertain-warning")}</Infobox>
      )}
      {/* A refusal drops both state moves from the row; its reason renders once in their place. */}
      {refusal !== null && <p className={cx(noteCss, proseCss)}>{refusalSentence(t, refusal)}</p>}
      {actions.length === 0 && refusal === null && registration.error_code && (
        <p className={cx(noteCss, proseCss)}>{failureOwnerHeading(t, owner)}</p>
      )}
      {(actions.length > 0 || dismissFlagAction !== null) && (
        <div className={actionsRowCss}>
          {actions}
          {dismissFlagAction}
        </div>
      )}
      {retryBlockedReason && <p className={cx(noteCss, proseCss)}>{retryBlockedReason}</p>}
      {refusal === null && (
        <div className={cancelRowCss}>
          <TransitionAction
            registration={registration}
            choice={CANCELLED}
            label={t(TRANSITION_COPY[CANCELLED].label)}
            description={t(TRANSITION_COPY[CANCELLED].description)}
            appliedMessage={t(TRANSITION_COPY[CANCELLED].appliedMessage)}
            triggerVariant={BUTTON_TERTIARY}
            isDestructive
          />
        </div>
      )}
    </div>
  )
}

export default AdminTransitionBlock
