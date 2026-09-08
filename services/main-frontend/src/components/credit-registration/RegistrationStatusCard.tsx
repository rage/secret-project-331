"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { includeIf } from "@/shared-module/common/utils/nullability"
import type { RegistrationStatusState } from "@/shared-module/components"
import {
  Button,
  Infobox,
  Link,
  RegistrationStatusBadge,
  RegistrationStatusHeadline,
  registrationStatusTone,
} from "@/shared-module/components"

import { BUTTON_PRIMARY, BUTTON_SECONDARY, CREDIT_REGISTRATION_NS } from "./constants"
import { noteCss, rowCss, sectionCss, spacedRowCss, subheadingCss, subsectionCss } from "./styles"

export interface RegistrationCardAction {
  key: string
  label: string
  /** Where it goes. Pass exactly one of `href` and `onAct`. */
  href?: string
  onAct?: () => void
  isDisabled?: boolean
  isLoading?: boolean
  /**
   * Why it cannot be used, rendered as visible text under the row.
   *
   * Not a `title`: a disabled button whose reason lives in a tooltip tells a touch reader nothing,
   * and "why is this greyed out" is the whole question.
   */
  disabledReason?: string
  /** `button` (default) draws a primary/secondary button; `link` is a plain text link beside it. */
  appearance?: "button" | "link"
}

export interface RegistrationStatusCardProps {
  state: RegistrationStatusState
  /** The status in the reader's words. */
  headline: string
  /** What the status means and what happens next. */
  explanation: React.ReactNode
  /**
   * The course, the part, the student. Passing it switches the card to list context: the subject
   * becomes the heading and the state a badge beside it, rather than the subject captioning a big
   * coloured headline — a list of these repeats the same headline as many times as it has cards.
   * Omit it on a standalone status page, where the page title already names the course.
   */
  subject?: React.ReactNode
  /** The one action worth a primary button, or nothing when this reader has none that helps. */
  primaryAction?: RegistrationCardAction | null
  secondaryActions?: readonly RegistrationCardAction[]
  /** Facts under the actions: dates, grade, credits, when it was last checked. */
  meta?: React.ReactNode
  className?: string
}

const ActionButton: React.FC<{ action: RegistrationCardAction; isPrimary: boolean }> = ({
  action,
  isPrimary,
}) => {
  if (action.appearance === "link" && action.href) {
    return <Link href={action.href}>{action.label}</Link>
  }
  const variant = isPrimary ? BUTTON_PRIMARY : BUTTON_SECONDARY
  if (action.href && !action.isDisabled) {
    return (
      <Link href={action.href} styledAsButton variant={variant} size="medium">
        {action.label}
      </Link>
    )
  }
  return (
    <Button
      variant={variant}
      size="medium"
      disabled={action.isDisabled ?? false}
      isLoading={action.isLoading ?? false}
      {...includeIf(action.onAct, { onClick: action.onAct })}
    >
      {action.label}
    </Button>
  )
}

/**
 * One registration's state, what it means, and what can be done about it.
 *
 * The one component for a registration shown as anything more than a badge, so a lever added to a
 * state appears on every surface that shows it rather than on the page that happened to get it.
 * Derive the actions with `failureActions` rather than choosing them per page. For the state alone
 * in a table cell use `RegistrationStatusBadge`.
 */
const RegistrationStatusCard: React.FC<RegistrationStatusCardProps> = ({
  state,
  headline,
  explanation,
  subject,
  primaryAction,
  secondaryActions = [],
  meta,
  className,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const actions = [...(primaryAction ? [primaryAction] : []), ...secondaryActions]
  const reasons = actions.filter((action) => action.isDisabled && action.disabledReason)

  const heading =
    state === "failed"
      ? t("heading-what-went-wrong")
      : state === "action-needed"
        ? t("heading-what-needs-to-happen")
        : null

  const body = <div className={subsectionCss}>{explanation}</div>

  return (
    <div className={cx(sectionCss, className)}>
      {subject ? (
        <div className={spacedRowCss}>
          <h3 className={subheadingCss}>{subject}</h3>
          <RegistrationStatusBadge state={state}>{headline}</RegistrationStatusBadge>
        </div>
      ) : (
        <RegistrationStatusHeadline state={state}>{headline}</RegistrationStatusHeadline>
      )}
      {heading === null ? (
        body
      ) : (
        <Infobox tone={registrationStatusTone[state]} heading={heading}>
          {body}
        </Infobox>
      )}
      {actions.length > 0 ? (
        <div className={rowCss}>
          {actions.map((action) => (
            <ActionButton key={action.key} action={action} isPrimary={action === primaryAction} />
          ))}
        </div>
      ) : null}
      {reasons.map((action) => (
        <p key={action.key} className={noteCss}>
          {action.disabledReason}
        </p>
      ))}
      {meta ? <div className={subsectionCss}>{meta}</div> : null}
    </div>
  )
}

export default RegistrationStatusCard
