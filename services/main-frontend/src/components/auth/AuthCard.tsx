"use client"

import { css, cx } from "@emotion/css"
import React from "react"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Button, Link } from "@/shared-module/components"

/** The result marks an `AuthCard` heading can carry. */
export type AuthCardStatusIcon = "mail" | "success" | "warning"

/** Props for `AuthCard`. */
export interface AuthCardProps {
  title: React.ReactNode
  /** Shown beside the title for a result state, such as an email sent or a broken link. */
  statusIcon?: AuthCardStatusIcon | undefined
  lede?: React.ReactNode | undefined
  /** Secondary routes out of the page, usually `AuthCardFooterLink`s. */
  footer?: React.ReactNode
  headingRef?: React.Ref<HTMLHeadingElement> | undefined
  headingId?: string | undefined
  children?: React.ReactNode
}

const CARD_PADDING = "2.25rem"
const CARD_PADDING_NARROW = "1rem"

const cardCss = css`
  max-width: 28rem;
  margin: 0.5rem auto 2rem;
  overflow: hidden;
  border: 1px solid var(--color-clear-400);
  border-radius: 14px;
  background: var(--color-clear-50);
  color: var(--color-gray-700);

  ${respondToOrLarger.xs} {
    margin: 5rem auto 4rem;
    box-shadow:
      0 1px 2px rgb(var(--shadow-rgb) / 0.04),
      0 12px 32px -16px rgb(var(--shadow-rgb) / 0.14);
  }
`

const contentCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem ${CARD_PADDING_NARROW};

  ${respondToOrLarger.xs} {
    padding: ${CARD_PADDING};
  }
`

const contentAboveFooterCss = css`
  ${respondToOrLarger.xs} {
    padding-bottom: 1.75rem;
  }
`

const headCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 0;
`

const titleRowCss = css`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`

const titleCss = css`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--color-gray-800);
  text-wrap: balance;
`

const ledeCss = css`
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--color-gray-500);
  text-wrap: pretty;

  strong {
    font-weight: 600;
    color: var(--color-gray-700);
    overflow-wrap: anywhere;
  }
`

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  min-width: 0;
`

const footerCss = css`
  display: grid;
  gap: 0.5rem;
  padding: 1rem ${CARD_PADDING_NARROW};
  border-top: 1px solid var(--color-clear-200);
  background: var(--color-clear-100);

  ${respondToOrLarger.xs} {
    padding-inline: ${CARD_PADDING};
  }
`

const statusIconBaseCss = css`
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
`

const statusIconCss: Record<AuthCardStatusIcon, string> = {
  mail: css`
    background: var(--color-blue-100);
    color: var(--color-blue-600);
  `,
  success: css`
    background: var(--color-green-100);
    color: var(--color-green-700);
  `,
  warning: css`
    background: var(--color-crimson-100);
    color: var(--color-crimson-700);
  `,
}

const STATUS_ICON_PATHS: Record<AuthCardStatusIcon, React.ReactNode> = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  success: <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth={2.4} />,
  warning: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.01" />
    </>
  ),
}

/**
 * The centred card every sign-in, sign-up and password page sits in, so they all read as one flow.
 */
export const AuthCard: React.FC<AuthCardProps> = ({
  title,
  statusIcon,
  lede,
  footer,
  headingRef,
  headingId,
  children,
}) => {
  return (
    <div className={cardCss}>
      <div className={cx(contentCss, footer ? contentAboveFooterCss : undefined)}>
        <div className={headCss}>
          <div className={titleRowCss}>
            {statusIcon ? (
              <span className={cx(statusIconBaseCss, statusIconCss[statusIcon])} aria-hidden="true">
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {STATUS_ICON_PATHS[statusIcon]}
                </svg>
              </span>
            ) : null}
            <h1 ref={headingRef} id={headingId} className={titleCss}>
              {title}
            </h1>
          </div>
          {lede ? <p className={ledeCss}>{lede}</p> : null}
        </div>
        {children ? <div className={bodyCss}>{children}</div> : null}
      </div>
      {footer ? <div className={footerCss}>{footer}</div> : null}
    </div>
  )
}

const footerLineCss = css`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-gray-500);
`

const footerLinkCss = css`
  margin-left: 0.125rem;
  color: var(--color-green-700);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--radius-1);
    box-shadow: none;
  }

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    color: var(--color-green-800);
  }
`

const arrowCss = css`
  margin-left: 0.25rem;
  vertical-align: -2px;
`

const arrow = (
  <svg
    className={arrowCss}
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

/** Props for `AuthCardFooterLink`: a destination `href`, or an `onPress` action. */
export type AuthCardFooterLinkProps = {
  /** The question the link answers, such as "Remembered your password?". */
  prompt: React.ReactNode
  children: React.ReactNode
} & ({ href: string; onPress?: never } | { onPress: () => void; href?: never })

/**
 * One "question? link →" line for an `AuthCard` footer. Pass `onPress` instead of `href` for an
 * action that stays on the page; it then renders as a button.
 */
export const AuthCardFooterLink: React.FC<AuthCardFooterLinkProps> = ({
  prompt,
  href,
  onPress,
  children,
}) => {
  return (
    <p className={footerLineCss}>
      {prompt}{" "}
      {href !== undefined ? (
        // oxlint-disable-next-line i18next/no-literal-string -- appearance enum value
        <Link href={href} appearance="inherit" className={footerLinkCss}>
          {children}
          {arrow}
        </Link>
      ) : (
        // oxlint-disable-next-line i18next/no-literal-string -- variant enum value
        <Button variant="link" onPress={onPress} className={footerLinkCss}>
          {children}
          {arrow}
        </Button>
      )}
    </p>
  )
}
