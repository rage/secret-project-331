"use client"

import { css } from "@emotion/css"
import React from "react"
import { Trans } from "react-i18next"

import type { CreditRegistrationTFunction } from "./constants"

const EMAIL_ADDRESS_PATTERN = /([^\s@]+@[^\s@]+\.[^\s@.,;:)]+)/

const nowrapCss = css`
  white-space: nowrap;
`

/** An email address that wraps only before its `@`. */
export const EmailAddress: React.FC<{ address: string }> = ({ address }) => {
  const at = address.indexOf("@")
  if (at <= 0) {
    return address
  }
  return (
    <>
      <span className={nowrapCss}>{address.slice(0, at)}</span>
      <wbr />
      <span className={nowrapCss}>{address.slice(at)}</span>
    </>
  )
}

/** The translations with an `<email/>` tag. */
type EmailAddressSentenceKey = "credit-registration-admin-journey-emailed-to"

/** The `i18nKey` sentence with its `<email/>` tag rendered as `address`. */
export const sentenceWithEmailAddress = (
  t: CreditRegistrationTFunction,
  i18nKey: EmailAddressSentenceKey,
  address: string,
): React.ReactElement => (
  <Trans t={t} i18nKey={i18nKey} components={{ email: <EmailAddress address={address} /> }} />
)

/** Free text from the server, such as an event's message, with any email address in it kept whole. */
export const TextWithEmailAddresses: React.FC<{ children: string }> = ({ children }) => (
  <>
    {children
      .split(EMAIL_ADDRESS_PATTERN)
      .map((part, index) => (index % 2 === 0 ? part : <EmailAddress key={index} address={part} />))}
  </>
)
