"use client"

import { css } from "@emotion/css"
import React from "react"
import { Trans } from "react-i18next"

import type { CreditRegistrationTFunction } from "./constants"

const EMAIL_ADDRESS_PATTERN = /([^\s@]+@[^\s@]+\.[^\s@.,;:)]+)/

/** Longer than this, a half could not fit a narrow column or a phone, so it may break inside. */
const LONGEST_UNBROKEN_HALF = 32

const nowrapCss = css`
  white-space: nowrap;
`

const breakableCss = css`
  overflow-wrap: anywhere;
`

const Half: React.FC<{ text: string }> = ({ text }) => (
  <span className={text.length > LONGEST_UNBROKEN_HALF ? breakableCss : nowrapCss}>{text}</span>
)

/** An email address that wraps before its `@`, and inside a half only when that half is too long to fit. */
export const EmailAddress: React.FC<{ address: string }> = ({ address }) => {
  const at = address.indexOf("@")
  if (at <= 0) {
    return address
  }
  return (
    <>
      <Half text={address.slice(0, at)} />
      <wbr />
      <Half text={address.slice(at)} />
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
