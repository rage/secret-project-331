"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAttentionItem } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import type { MenuItemDescriptor } from "@/shared-module/components"
import { Button, Link, Menu } from "@/shared-module/components"

import { BUTTON_SECONDARY, CREDIT_REGISTRATION_NS } from "../constants"
import { failureActionLabel } from "../registrationFailures"
import { noteCss, stackedCellCss } from "../styles"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import type { DialogOpenState } from "./AdminActionDialog"
import AdminDismissAttentionButton from "./AdminDismissAttentionButton"
import AdminLinkingCandidatesDialog from "./AdminLinkingCandidatesDialog"
import AdminManualLinkDialog from "./AdminManualLinkDialog"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import type { ActionResult } from "./AdminTransitionBlock"
import { CHECK_NOW_COPY, TransitionAction } from "./AdminTransitionBlock"
import { useFetchEnrolmentListNow } from "./FetchEnrolmentListNowButton"
import type { HandActionOffer, RemedyOffer } from "./handActionOffers"
import { CHECK_NOW_OFFER, handActionOffers, renderableRemedies, RESUBMIT } from "./handActionOffers"
import {
  GUESS_FROM_ENROLMENT_LIST,
  useStudentNumberStuckActions,
} from "./studentNumberStuckActions"
import { CANCELLED, CHECK_NOW, READY_TO_SUBMIT } from "./TransitionTargetSelect"

const EMAIL_STUDENT: RemedyOffer = "email_student"
const FETCH_NOW = "fetch_enrolment_list_now"
const CANCEL = "cancel"
const DESTRUCTIVE = "destructive" as const

/** Running late rows only get the actions that push them along. */
const RUNNING_LATE_OFFERS: ReadonlySet<HandActionOffer> = new Set([RESUBMIT, CHECK_NOW_OFFER])

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
`

/** One thing the row lets a person do: a link to go to, something to run, or a dialog to open. */
type RowAction = {
  key: string
  label: string
  isDestructive?: boolean
} & (
  | { href: string }
  | { onRun: () => void }
  | { dialog: (openState: DialogOpenState) => React.ReactNode }
)

/**
 * A Needs attention row's actions: its best remedy as a button, the others in a More menu, and
 * Dismiss last. A stuck presser gets the linking actions; every other row its remedies, and
 * Cancel once Sisu has stopped accepting retries.
 */
const AttentionRowActions: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const stuckActions = useStudentNumberStuckActions()
  const [lastResult, setLastResult] = useState<ActionResult | null>(null)
  const [openDialog, setOpenDialog] = useState<string | null>(null)
  const fetchNow = useFetchEnrolmentListNow(item.uh_course_code ?? "")
  const isRunningLate = item.standing === "running_late"
  const isStudentNumberStuck = item.reasons.includes("student_number_stuck")
  const studentName = formatUserName(item)
  const dialogOpenState = (key: string): DialogOpenState => ({
    isOpen: openDialog === key,
    onClose: () => setOpenDialog(null),
  })
  const emailAction: RowAction | null = item.email
    ? {
        key: EMAIL_STUDENT,
        label: failureActionLabel(t, EMAIL_STUDENT),
        href: `mailto:${item.email}`,
      }
    : null

  const { offers, recommended } = handActionOffers(
    item,
    renderableRemedies({
      hasEmail: Boolean(item.email),
      hasStudentNumber: Boolean(item.student_number),
      isAccountLinkingEnabled,
    }),
  )
  const resubmission =
    item.hand_actions.resubmission.kind === "allowed" ? item.hand_actions.resubmission : null
  const checkNowCopy = item.hand_actions.check_now
    ? CHECK_NOW_COPY[item.hand_actions.check_now]
    : null
  const canCancel =
    !isStudentNumberStuck &&
    !isRunningLate &&
    item.reasons.includes("retry_window_expired") &&
    (item.hand_actions.cancel_refusal ?? null) === null

  const offerAction = (offer: HandActionOffer): RowAction | null => {
    switch (offer) {
      case RESUBMIT:
        return resubmission
          ? {
              key: offer,
              label: t("credit-registration-admin-target-resubmit"),
              dialog: (openState) => (
                <TransitionAction
                  registrationId={item.credit_registration_id}
                  choice={READY_TO_SUBMIT}
                  label={t("credit-registration-admin-target-resubmit")}
                  explanation={t("credit-registration-admin-resubmit-description")}
                  appliedMessage={t("credit-registration-admin-resubmit-applied")}
                  triggerVariant={BUTTON_SECONDARY}
                  risk={resubmission.risk}
                  onResult={setLastResult}
                  openState={openState}
                />
              ),
            }
          : null
      case CHECK_NOW_OFFER:
        return checkNowCopy
          ? {
              key: offer,
              label: t(checkNowCopy.label),
              dialog: (openState) => (
                <TransitionAction
                  registrationId={item.credit_registration_id}
                  choice={CHECK_NOW}
                  label={t(checkNowCopy.label)}
                  explanation={t(checkNowCopy.description)}
                  appliedMessage={t("credit-registration-admin-check-now-applied")}
                  triggerVariant={BUTTON_SECONDARY}
                  onResult={setLastResult}
                  openState={openState}
                />
              ),
            }
          : null
      case "fix_module_configuration":
        return {
          key: offer,
          label: failureActionLabel(t, offer),
          href: manageCourseModulesRoute(item.course_id),
        }
      case "email_student":
        return emailAction
      case "link_student_number_by_hand": {
        const studentNumber = item.student_number
        return studentNumber
          ? {
              key: offer,
              label: failureActionLabel(t, offer),
              dialog: (openState) =>
                openState.isOpen && (
                  <AdminManualLinkDialog
                    {...openState}
                    account={{
                      userId: item.user_id,
                      name: studentName,
                      email: item.email ?? null,
                    }}
                    studentNumber={studentNumber}
                  />
                ),
            }
          : null
      }
      case "resend_student_number_link": {
        const studentNumber = item.student_number
        return studentNumber
          ? {
              key: offer,
              label: failureActionLabel(t, offer),
              dialog: (openState) => (
                <AdminResendLinkingEmailDialog
                  {...openState}
                  studentNumber={studentNumber}
                  courseId={item.course_id}
                  courseName={item.course_name}
                />
              ),
            }
          : null
      }
    }
  }

  const actions: RowAction[] = (
    isStudentNumberStuck
      ? [
          ...stuckActions.map((action): RowAction => ({
            ...action,
            dialog: (openState) =>
              action.key === GUESS_FROM_ENROLMENT_LIST ? (
                <AdminLinkingCandidatesDialog
                  {...openState}
                  registrationId={item.credit_registration_id}
                />
              ) : (
                openState.isOpen && (
                  <AdminManualLinkDialog
                    {...openState}
                    account={{
                      userId: item.user_id,
                      name: studentName,
                      email: item.email ?? null,
                    }}
                  />
                )
              ),
          })),
          emailAction,
          item.uh_course_code
            ? {
                key: FETCH_NOW,
                label: t("button-text-fetch-enrolment-list-now"),
                onRun: () => void fetchNow.run(),
              }
            : null,
        ]
      : [
          // The recommended remedy leads; the order of the rest is the offers' own.
          ...offers
            .filter((offer) => !isRunningLate || RUNNING_LATE_OFFERS.has(offer))
            .toSorted((a, b) => Number(b === recommended) - Number(a === recommended))
            .map((offer) => offerAction(offer)),
          canCancel
            ? {
                key: CANCEL,
                label: t("credit-registration-admin-target-cancel"),
                isDestructive: true,
                dialog: (openState: DialogOpenState) => (
                  <TransitionAction
                    registrationId={item.credit_registration_id}
                    choice={CANCELLED}
                    label={t("credit-registration-admin-target-cancel")}
                    explanation={t("credit-registration-admin-cancel-description")}
                    appliedMessage={t("credit-registration-admin-cancel-applied")}
                    triggerVariant={BUTTON_SECONDARY}
                    isDestructive
                    onResult={setLastResult}
                    openState={openState}
                  />
                ),
              }
            : null,
        ]
  ).filter((action): action is RowAction => action !== null)

  const run = (action: RowAction) =>
    "onRun" in action ? action.onRun : () => setOpenDialog(action.key)
  const [main, ...rest] = actions
  const menuItems = rest.map((action): MenuItemDescriptor => ({
    key: action.key,
    label: action.label,
    ...("href" in action ? { href: action.href } : { onAction: run(action) }),
    ...(action.isDestructive ? { tone: DESTRUCTIVE } : {}),
  }))

  return (
    <span className={stackedCellCss}>
      <span className={actionsCss}>
        {main &&
          ("href" in main ? (
            <Link href={main.href} styledAsButton variant={BUTTON_SECONDARY} size="medium">
              {main.label}
            </Link>
          ) : (
            <Button variant={BUTTON_SECONDARY} size="medium" onClick={run(main)}>
              {main.label}
            </Button>
          ))}
        {menuItems.length > 0 && (
          <Menu
            label={t("credit-registration-admin-more-actions")}
            size="medium"
            aria-label={t("credit-registration-admin-more-actions-for", { student: studentName })}
            items={menuItems}
          />
        )}
        {!isRunningLate && (
          <AdminDismissAttentionButton registrationId={item.credit_registration_id} />
        )}
      </span>
      {lastResult && <span className={noteCss}>{lastResult.message}</span>}
      {actions.map(
        (action) =>
          "dialog" in action && (
            <React.Fragment key={action.key}>
              {action.dialog(dialogOpenState(action.key))}
            </React.Fragment>
          ),
      )}
    </span>
  )
}

export default AttentionRowActions
