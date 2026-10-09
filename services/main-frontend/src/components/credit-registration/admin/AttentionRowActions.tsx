"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
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
import AdminDismissAttentionButton from "./AdminDismissAttentionButton"
import AdminLinkingCandidatesDialog from "./AdminLinkingCandidatesDialog"
import AdminManualLinkDialog from "./AdminManualLinkDialog"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import type { ActionResult } from "./AdminTransitionBlock"
import { CHECK_NOW_COPY, TransitionAction } from "./AdminTransitionBlock"
import { useFetchEnrolmentListNow } from "./FetchEnrolmentListNowButton"
import type { HandActionOffer, RemedyOffer } from "./handActionOffers"
import { CHECK_NOW_OFFER, handActionOffers, renderableRemedies, RESUBMIT } from "./handActionOffers"
import { CANCELLED, CHECK_NOW, READY_TO_SUBMIT } from "./TransitionTargetSelect"

const EMAIL_STUDENT: RemedyOffer = "email_student"
const LINK_BY_HAND: RemedyOffer = "link_student_number_by_hand"
const RESEND_LINK: RemedyOffer = "resend_student_number_link"
const GUESS = "guess_from_enrolment_list"
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

/** Pushed to the far end: dismissing does not move the registration forward. */
const apartCss = css`
  margin-left: auto;
`

/** One thing the row lets a person do: a link to go to, or a dialog to open. */
type RowAction = {
  key: string
  label: string
  isDestructive?: boolean
} & ({ href: string } | { onOpen: () => void })

/**
 * A Needs attention row's actions: its best remedy as a button, the others in a More menu, and
 * Dismiss set apart. A stuck presser gets the linking actions, led by a guess from the enrolment
 * list on a code with unmailed early enrolees; every other row its remedies, and Cancel once Sisu
 * has stopped accepting retries.
 */
const AttentionRowActions: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const router = useRouter()
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const [lastResult, setLastResult] = useState<ActionResult | null>(null)
  const [openDialog, setOpenDialog] = useState<string | null>(null)
  const fetchNow = useFetchEnrolmentListNow(item.uh_course_code ?? "")
  const isRunningLate = item.standing === "running_late"
  const isStudentNumberStuck = item.reasons.includes("student_number_stuck")
  const studentName = formatUserName(item)
  const account = { userId: item.user_id, name: studentName, email: item.email ?? null }
  const dialogOpenState = (key: string) => ({
    isOpen: openDialog === key,
    onClose: () => setOpenDialog(null),
  })
  const opens = (key: string) => () => setOpenDialog(key)
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
  const checkNow = item.hand_actions.check_now ?? null
  const canCancel =
    !isStudentNumberStuck &&
    !isRunningLate &&
    item.reasons.includes("retry_window_expired") &&
    (item.hand_actions.cancel_refusal ?? null) === null

  const offerAction = (offer: HandActionOffer): RowAction | null => {
    switch (offer) {
      case RESUBMIT:
        return item.hand_actions.resubmission.kind === "allowed"
          ? {
              key: offer,
              label: t("credit-registration-admin-target-resubmit"),
              onOpen: opens(offer),
            }
          : null
      case CHECK_NOW_OFFER:
        return checkNow === null
          ? null
          : { key: offer, label: t(CHECK_NOW_COPY[checkNow].label), onOpen: opens(offer) }
      case "fix_module_configuration":
        return {
          key: offer,
          label: failureActionLabel(t, offer),
          href: manageCourseModulesRoute(item.course_id),
        }
      case "email_student":
        return emailAction
      case "link_student_number_by_hand":
      case "resend_student_number_link":
        return item.student_number
          ? { key: offer, label: failureActionLabel(t, offer), onOpen: opens(offer) }
          : null
    }
  }

  const canGuess = isAccountLinkingEnabled && (item.unlinked_enrolled_before_count ?? 0) > 0
  const actions: RowAction[] = (
    isStudentNumberStuck
      ? [
          canGuess
            ? {
                key: GUESS,
                label: t("button-text-guess-from-enrolment-list"),
                onOpen: opens(GUESS),
              }
            : null,
          {
            key: LINK_BY_HAND,
            label: failureActionLabel(t, LINK_BY_HAND),
            onOpen: opens(LINK_BY_HAND),
          },
          emailAction,
          item.uh_course_code
            ? {
                key: FETCH_NOW,
                label: t("button-text-fetch-enrolment-list-now"),
                onOpen: () => void fetchNow.run(),
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
                onOpen: opens(CANCEL),
              }
            : null,
        ]
  ).filter((action): action is RowAction => action !== null)

  const [main, ...rest] = actions
  const menuItems = rest.map((action): MenuItemDescriptor => ({
    key: action.key,
    label: action.label,
    onAction: "href" in action ? () => router.push(action.href) : action.onOpen,
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
            <Button variant={BUTTON_SECONDARY} size="medium" onClick={main.onOpen}>
              {main.label}
            </Button>
          ))}
        {menuItems.length > 0 && (
          <Menu
            label={t("credit-registration-admin-more-actions")}
            aria-label={t("credit-registration-admin-more-actions-for", { student: studentName })}
            items={menuItems}
          />
        )}
        {!isRunningLate && (
          <span className={apartCss}>
            <AdminDismissAttentionButton registrationId={item.credit_registration_id} />
          </span>
        )}
      </span>
      {lastResult && <span className={noteCss}>{lastResult.message}</span>}
      {actions.some((action) => action.key === RESUBMIT) &&
        item.hand_actions.resubmission.kind === "allowed" && (
          <TransitionAction
            registrationId={item.credit_registration_id}
            choice={READY_TO_SUBMIT}
            label={t("credit-registration-admin-target-resubmit")}
            explanation={t("credit-registration-admin-resubmit-description")}
            appliedMessage={t("credit-registration-admin-resubmit-applied")}
            triggerVariant={BUTTON_SECONDARY}
            risk={item.hand_actions.resubmission.risk}
            onResult={setLastResult}
            openState={dialogOpenState(RESUBMIT)}
          />
        )}
      {actions.some((action) => action.key === CHECK_NOW_OFFER) && checkNow !== null && (
        <TransitionAction
          registrationId={item.credit_registration_id}
          choice={CHECK_NOW}
          label={t(CHECK_NOW_COPY[checkNow].label)}
          explanation={t(CHECK_NOW_COPY[checkNow].description)}
          appliedMessage={t("credit-registration-admin-check-now-applied")}
          triggerVariant={BUTTON_SECONDARY}
          onResult={setLastResult}
          openState={dialogOpenState(CHECK_NOW_OFFER)}
        />
      )}
      {canCancel && (
        <TransitionAction
          registrationId={item.credit_registration_id}
          choice={CANCELLED}
          label={t("credit-registration-admin-target-cancel")}
          explanation={t("credit-registration-admin-cancel-description")}
          appliedMessage={t("credit-registration-admin-cancel-applied")}
          triggerVariant={BUTTON_SECONDARY}
          isDestructive
          onResult={setLastResult}
          openState={dialogOpenState(CANCEL)}
        />
      )}
      {openDialog === LINK_BY_HAND && (
        <AdminManualLinkDialog
          open
          onClose={() => setOpenDialog(null)}
          account={account}
          {...(isStudentNumberStuck || !item.student_number
            ? {}
            : { studentNumber: item.student_number })}
        />
      )}
      {item.student_number && (
        <AdminResendLinkingEmailDialog
          open={openDialog === RESEND_LINK}
          onClose={() => setOpenDialog(null)}
          studentNumber={item.student_number}
          courseId={item.course_id}
          courseName={item.course_name}
        />
      )}
      {canGuess && (
        <AdminLinkingCandidatesDialog
          open={openDialog === GUESS}
          onClose={() => setOpenDialog(null)}
          registrationId={item.credit_registration_id}
        />
      )}
    </span>
  )
}

export default AttentionRowActions
