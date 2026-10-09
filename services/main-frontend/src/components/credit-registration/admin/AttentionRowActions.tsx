"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationAttentionItem } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import { Link } from "@/shared-module/components"

import { BUTTON_SECONDARY, BUTTON_TERTIARY, CREDIT_REGISTRATION_NS } from "../constants"
import { failureActionLabel } from "../registrationFailures"
import { noteCss, rowCss, stackedCellCss } from "../styles"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import AdminDismissAttentionButton from "./AdminDismissAttentionButton"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminResendLinkingEmailButton from "./AdminResendLinkingEmailButton"
import type { ActionResult } from "./AdminTransitionBlock"
import { CHECK_NOW_COPY, TransitionAction } from "./AdminTransitionBlock"
import FetchEnrolmentListNowButton from "./FetchEnrolmentListNowButton"
import type { HandActionOffer, RemedyOffer } from "./handActionOffers"
import { CHECK_NOW_OFFER, handActionOffers, renderableRemedies, RESUBMIT } from "./handActionOffers"
import { CANCELLED, CHECK_NOW, READY_TO_SUBMIT } from "./TransitionTargetSelect"

const EMAIL_STUDENT: RemedyOffer = "email_student"
const LINK_BY_HAND: RemedyOffer = "link_student_number_by_hand"

/** A table cell has room for the next step and one alternative; the rest are on the row's page. */
const MAX_OFFERS = 2

/** Running late rows only get the actions that push them along. */
const RUNNING_LATE_OFFERS: ReadonlySet<HandActionOffer> = new Set([RESUBMIT, CHECK_NOW_OFFER])

/**
 * The actions a Needs attention row offers in its own cell. A stuck presser gets the linking
 * actions; every other row its best remedies, then Dismiss, and Cancel once Sisu has stopped
 * accepting retries.
 */
const AttentionRowActions: React.FC<{ item: CreditRegistrationAttentionItem }> = ({ item }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const [lastResult, setLastResult] = useState<ActionResult | null>(null)
  const isRunningLate = item.standing === "running_late"

  if (item.reasons.includes("student_number_stuck")) {
    return (
      <span className={rowCss}>
        {item.email && (
          <Link
            href={`mailto:${item.email}`}
            styledAsButton
            variant={BUTTON_SECONDARY}
            size="medium"
          >
            {failureActionLabel(t, EMAIL_STUDENT)}
          </Link>
        )}
        <AdminManualLinkButton
          account={{ userId: item.user_id, name: formatUserName(item), email: item.email ?? null }}
          label={failureActionLabel(t, LINK_BY_HAND)}
          variant={BUTTON_SECONDARY}
        />
        {item.uh_course_code && <FetchEnrolmentListNowButton courseCode={item.uh_course_code} />}
        <AdminDismissAttentionButton registrationId={item.credit_registration_id} />
      </span>
    )
  }

  const { offers, recommended } = handActionOffers(
    item,
    renderableRemedies({
      hasEmail: Boolean(item.email),
      hasStudentNumber: Boolean(item.student_number),
      isAccountLinkingEnabled,
    }),
  )
  const shown = offers
    .filter((offer) => !isRunningLate || RUNNING_LATE_OFFERS.has(offer))
    .slice(0, MAX_OFFERS)
  const variantFor = (offer: HandActionOffer) =>
    offer === recommended ? BUTTON_SECONDARY : BUTTON_TERTIARY
  const checkNow = item.hand_actions.check_now ?? null
  const canCancel =
    !isRunningLate &&
    item.reasons.includes("retry_window_expired") &&
    (item.hand_actions.cancel_refusal ?? null) === null

  const renderOffer = (offer: HandActionOffer): React.ReactNode => {
    switch (offer) {
      case RESUBMIT:
        return item.hand_actions.resubmission.kind === "allowed" ? (
          <TransitionAction
            key={offer}
            registrationId={item.credit_registration_id}
            choice={READY_TO_SUBMIT}
            label={t("credit-registration-admin-target-resubmit")}
            explanation={t("credit-registration-admin-resubmit-description")}
            appliedMessage={t("credit-registration-admin-resubmit-applied")}
            triggerVariant={variantFor(offer)}
            risk={item.hand_actions.resubmission.risk}
            onResult={setLastResult}
          />
        ) : null
      case CHECK_NOW_OFFER:
        return checkNow === null ? null : (
          <TransitionAction
            key={offer}
            registrationId={item.credit_registration_id}
            choice={CHECK_NOW}
            label={t(CHECK_NOW_COPY[checkNow].label)}
            explanation={t(CHECK_NOW_COPY[checkNow].description)}
            appliedMessage={t("credit-registration-admin-check-now-applied")}
            triggerVariant={variantFor(offer)}
            onResult={setLastResult}
          />
        )
      case "fix_module_configuration":
        return (
          <Link
            key={offer}
            href={manageCourseModulesRoute(item.course_id)}
            styledAsButton
            variant={variantFor(offer)}
            size="medium"
          >
            {failureActionLabel(t, offer)}
          </Link>
        )
      case "email_student":
        return (
          <Link
            key={offer}
            href={`mailto:${item.email}`}
            styledAsButton
            variant={variantFor(offer)}
            size="medium"
          >
            {failureActionLabel(t, offer)}
          </Link>
        )
      case "link_student_number_by_hand":
        return item.student_number ? (
          <AdminManualLinkButton
            key={offer}
            studentNumber={item.student_number}
            account={{
              userId: item.user_id,
              name: formatUserName(item),
              email: item.email ?? null,
            }}
            label={failureActionLabel(t, offer)}
            variant={variantFor(offer)}
          />
        ) : null
      case "resend_student_number_link":
        return item.student_number ? (
          <AdminResendLinkingEmailButton
            key={offer}
            studentNumber={item.student_number}
            courseId={item.course_id}
            courseName={item.course_name}
            variant={variantFor(offer)}
          />
        ) : null
    }
  }

  return (
    <span className={stackedCellCss}>
      <span className={rowCss}>
        {shown.map((offer) => renderOffer(offer))}
        {!isRunningLate && (
          <AdminDismissAttentionButton registrationId={item.credit_registration_id} />
        )}
        {canCancel && (
          <TransitionAction
            registrationId={item.credit_registration_id}
            choice={CANCELLED}
            label={t("credit-registration-admin-target-cancel")}
            explanation={t("credit-registration-admin-cancel-description")}
            appliedMessage={t("credit-registration-admin-cancel-applied")}
            triggerVariant={BUTTON_TERTIARY}
            isDestructive
            onResult={setLastResult}
          />
        )}
      </span>
      {lastResult && <span className={noteCss}>{lastResult.message}</span>}
    </span>
  )
}

export default AttentionRowActions
