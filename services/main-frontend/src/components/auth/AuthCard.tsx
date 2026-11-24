"use client"

import { css, cx } from "@emotion/css"
import { ArrowRight, CheckCircle, Envelope, ExclamationTriangle } from "@vectopus/atlas-icons-react"
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
  border-radius: var(--radius-4);
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
  font-size: var(--font-size-4);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--color-gray-800);
  text-wrap: balance;
`

const ledeCss = css`
  margin: 0;
  font-size: var(--font-size-2);
  line-height: 1.55;
  color: var(--color-gray-500);
  text-wrap: pretty;

  strong {
    font-weight: 600;
    color: var(--color-gray-700);
    overflow-wrap: anywhere;
  }
`

/** The vertical rhythm of an `AuthCard` body; use it for a form inside the card too. */
export const authCardStackCss = css`
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

const STATUS_ICONS: Record<AuthCardStatusIcon, { Icon: typeof Envelope; className: string }> = {
  mail: {
    Icon: Envelope,
    className: css`
      background: var(--color-blue-100);
      color: var(--color-blue-600);
    `,
  },
  success: {
    Icon: CheckCircle,
    className: css`
      background: var(--color-green-100);
      color: var(--color-green-700);
    `,
  },
  warning: {
    Icon: ExclamationTriangle,
    className: css`
      background: var(--color-crimson-100);
      color: var(--color-crimson-700);
    `,
  },
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
  const status = statusIcon && STATUS_ICONS[statusIcon]
  return (
    <div className={cardCss}>
      <div className={cx(contentCss, Boolean(footer) && contentAboveFooterCss)}>
        <div className={headCss}>
          <div className={titleRowCss}>
            {status && (
              <span className={cx(statusIconBaseCss, status.className)} aria-hidden="true">
                <status.Icon size={16} weight="bold" />
              </span>
            )}
            <h1 ref={headingRef} id={headingId} className={titleCss}>
              {title}
            </h1>
          </div>
          {lede && <p className={ledeCss}>{lede}</p>}
        </div>
        {children && <div className={authCardStackCss}>{children}</div>}
      </div>
      {footer && <div className={footerCss}>{footer}</div>}
    </div>
  )
}

const footerLineCss = css`
  margin: 0;
  font-size: var(--font-size-1);
  line-height: 1.45;
  color: var(--color-gray-500);
`

const footerLinkCss = css`
  --link-fg: var(--color-green-700);
  --link-fg-hover: var(--color-green-800);
  margin-left: 0.125rem;
  font-weight: 600;
  white-space: nowrap;
`

const arrowCss = css`
  display: inline-flex;
  margin-left: 0.25rem;
  vertical-align: -2px;
`

const arrow = (
  <span className={arrowCss} aria-hidden="true">
    <ArrowRight size={14} weight="bold" />
  </span>
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
        <Link href={href} className={footerLinkCss}>
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
