"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { CopyButton, Link } from "@/shared-module/components"

import { SUPPORT_EMAIL } from "./constants"
import { monospaceCss, noteCss, rowCss } from "./styles"

export interface SupportMailLinkProps {
  /** What the mail is about, in the reader's words: the course, the part, the status. */
  subject: string
  /**
   * The prefilled body, one entry per line. Put everything support needs to find the case here —
   * the registration id, the course, the student number, the status — so nobody has to be asked
   * to "mention the course".
   */
  bodyLines: readonly string[]
  /**
   * An identifier support can search for, shown beside the link with a copy button.
   *
   * Worth passing whenever one exists: a mail client that drops the prefilled body leaves the
   * reader with nothing to quote, and support with nothing to look up.
   */
  reference?: string | null
  /** Defaults to "Email support about this". */
  label?: string
  /** `button` is the primary lever on a failure; `link` sits in running text. */
  appearance?: "button" | "link"
  /** Renders only the reference line, for a caller that already put the mail link elsewhere. */
  referenceOnly?: boolean
}

/** Built here and exported so a caller offering the same mail as its own primary action reuses it. */
export const mailHref = (subject: string, bodyLines: readonly string[]): string => {
  const query = new URLSearchParams({ subject, body: bodyLines.join("\n") })
  // URLSearchParams renders spaces as "+", which mail clients put in the subject line verbatim.
  return `mailto:${SUPPORT_EMAIL}?${query.toString().replaceAll("+", "%20")}`
}

/** One line of running text so the label, the value and the copy button can never wrap apart. */
const referenceLineCss = cx(
  noteCss,
  css`
    overflow-wrap: anywhere;
  `,
)

const ReferenceLine: React.FC<{ reference: string }> = ({ reference }) => {
  const { t } = useTranslation()
  return (
    <p className={referenceLineCss}>
      {t("label-credit-registration-support-reference")}{" "}
      <span className={monospaceCss}>{reference}</span>{" "}
      <CopyButton
        value={reference}
        label={t("button-text-copy-credit-registration-support-reference")}
      />
    </p>
  )
}

/**
 * The one way this feature offers to reach support: a mail already filled in with the case.
 *
 * Every surface that says "contact support" should use this rather than a bare `mailto:`, so a
 * reader never has to describe their own registration and support never gets a mail it cannot
 * trace to a row.
 */
const SupportMailLink: React.FC<SupportMailLinkProps> = ({
  subject,
  bodyLines,
  reference,
  label,
  appearance = "button",
  referenceOnly = false,
}) => {
  const { t } = useTranslation()
  const href = mailHref(subject, bodyLines)
  const text = label ?? t("credit-registration-action-label-contact-support")

  if (referenceOnly) {
    return reference ? <ReferenceLine reference={reference} /> : null
  }

  return (
    <span className={rowCss}>
      {appearance === "button" ? (
        <Link href={href} styledAsButton variant="secondary" size="medium">
          {text}
        </Link>
      ) : (
        <Link href={href}>{text}</Link>
      )}
      {reference ? <ReferenceLine reference={reference} /> : null}
    </span>
  )
}

export default SupportMailLink
