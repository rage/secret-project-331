"use client"

import { css, cx, keyframes } from "@emotion/css"
import { ExclamationTriangle, InfoCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { createContext, useContext, useLayoutEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { ErrorSeverity, ErrorViewModel } from "../lib/errors/normalizeErrorForDisplay"
import { normalizeErrorForDisplay } from "../lib/errors/normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "../lib/errors/resolveErrorDisplayCopy"
import { below } from "../styles/breakpoints"
import { Button } from "./Button"
import { CopyButton, type CopyButtonAppearance } from "./CopyButton"
import { DescriptionList } from "./DescriptionList"
import { Disclosure } from "./Disclosure"

/**
 * Lets the app register the document title for a page-level error (`headingLevel={1}`). Provided
 * by the common package's `ErrorNoticeTitleProvider`, which owns the title; `null` outside it.
 */
export const ErrorNoticeTitleContext = createContext<((title: string | null) => void) | null>(null)

/** Client errors the reader cannot fix by retrying the same request. */
function isNonRetryableStatus(status: number | null): boolean {
  return status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429
}

/** How the notice reaches assistive technology. */
export type ErrorNoticeAnnouncement = "assertive" | "polite" | "off"

export type ErrorNoticeDensity = "comfortable" | "compact"

export const COMFORTABLE_DENSITY: ErrorNoticeDensity = "comfortable"
export const COMPACT_DENSITY: ErrorNoticeDensity = "compact"

export interface ErrorNoticeProps {
  /** The thrown value, in any shape `normalizeErrorForDisplay` understands. */
  error: unknown
  /** Shown above the parsed message: what the reader was doing when this failed. */
  context?: React.ReactNode
  /** Overrides the severity derived from the error. */
  severity?: ErrorSeverity
  /**
   * `assertive` (the default) interrupts to announce a failure now, matching every pre-existing
   * caller's `role="alert"`. Use `polite` for a notice that replaces a region the reader is
   * already in, and `off` when the notice is part of the page on first paint, where any live
   * region interrupts the page being announced.
   */
  announce?: ErrorNoticeAnnouncement
  /** Heading rank of the title. Pick the one that fits the surrounding outline. */
  headingLevel?: 1 | 2 | 3 | 4
  /**
   * `compact` is for a notice inside a form or a small panel: slimmer padding and type, and the
   * copy-report action as a quiet link.
   */
  density?: ErrorNoticeDensity
  /** CSS length capping the notice, which then scrolls. */
  maxHeight?: string
  /** CSS length capping the technical details panel, which then scrolls. */
  detailsMaxHeight?: string
  retry?: () => void
  className?: string
  "data-testid"?: string | undefined
}

interface DetailRow {
  label: string
  value: string
}

interface DetailBlock {
  label: string
  text: string
}

const ANNOUNCEMENT_ROLES: Record<ErrorNoticeAnnouncement, "alert" | "status" | undefined> = {
  assertive: "alert",
  polite: "status",
  off: undefined,
}

const SEVERITY_ICONS: Record<ErrorSeverity, React.ComponentType<{ size?: number }>> = {
  error: XmarkCircle,
  warning: ExclamationTriangle,
  info: InfoCircle,
}

const ICON_SIZE: Record<ErrorNoticeDensity, number> = { comfortable: 20, compact: 16 }
const COPY_BUTTON_APPEARANCE: Record<ErrorNoticeDensity, CopyButtonAppearance> = {
  comfortable: "button",
  compact: "link",
}

/** Lines compact content up with the title text, past the icon. */
const COMPACT_TEXT_INDENT = `calc(${ICON_SIZE.compact}px + var(--space-3))`
const REPORT_INDENT = "  "

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
`

const rootCss = css`
  display: grid;
  gap: var(--space-3);
  width: 100%;
  border: 1px solid transparent;
  border-left-width: 4px;
  border-radius: var(--radius-3);
  color: var(--color-gray-700);
  font-family: var(--font-sans);
  font-size: var(--font-size-2);
  line-height: 1.5;
  overflow: auto;
  animation: ${fadeIn} var(--duration-base) var(--ease-entrance);

  /* Tints and the accent edge are flattened in high contrast mode, leaving the notice unbounded. */
  @media (forced-colors: active) {
    border-color: CanvasText;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const densityCss: Record<ErrorNoticeDensity, string> = {
  comfortable: css`
    padding: var(--space-5);
  `,
  compact: css`
    gap: var(--space-2);
    padding: var(--space-3-5) var(--space-4);
    border-left-width: 3px;
    font-size: var(--font-size-1);
  `,
}

/** The compact notice's hairline border, tinted to match the accent edge. */
const compactSeverityBorderCss: Record<ErrorSeverity, string> = {
  error: css`
    border-color: var(--color-crimson-100);
    border-left-color: var(--color-crimson-700);
  `,
  warning: css`
    border-color: var(--color-red-100);
    border-left-color: var(--color-red-700);
  `,
  info: css`
    border-color: var(--color-blue-100);
    border-left-color: var(--color-blue-600);
  `,
}

const severityCss: Record<ErrorSeverity, string> = {
  error: css`
    background: var(--color-crimson-50);
    border-left-color: var(--color-crimson-700);
  `,
  warning: css`
    background: var(--color-red-50);
    border-left-color: var(--color-red-700);
  `,
  info: css`
    background: var(--color-blue-50);
    border-left-color: var(--color-blue-600);
  `,
}

const iconSeverityCss: Record<ErrorSeverity, string> = {
  error: css`
    color: var(--color-crimson-700);
  `,
  warning: css`
    color: var(--color-red-700);
  `,
  info: css`
    color: var(--color-blue-600);
  `,
}

const headerCss = css`
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
`

const iconCss = css`
  display: inline-flex;
  flex: none;
  padding-top: 2px;
`

const titleCss = css`
  margin: 0;
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
`

const compactHeaderCss = css`
  align-items: center;
`

const compactIconCss = css`
  padding-top: 0;
`

const compactTitleCss = css`
  font-size: var(--font-size-2);
  color: var(--color-gray-800);
`

const compactSummaryRowCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-2) var(--space-4);

  ${below("xs")} {
    flex-direction: column;
    align-items: flex-start;
  }
`

const compactSummaryCss = css`
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  gap: var(--space-1);
`

/** Collapses when empty so it adds no gap to the notice's grid. */
const compactIndentCss = css`
  display: grid;
  margin-left: ${COMPACT_TEXT_INDENT};

  &:empty {
    display: none;
  }
`

const compactSummaryTextCss = css`
  gap: var(--space-1);
`

const compactBodyCss = css`
  gap: var(--space-2);
`

const compactActionsBesideTitleCss = css`
  flex: none;

  ${below("xs")} {
    padding-left: ${COMPACT_TEXT_INDENT};
  }
`

const paragraphCss = css`
  margin: 0;
  color: var(--color-gray-600);
  overflow-wrap: anywhere;
`

const issuesCss = css`
  margin: 0;
  padding-left: var(--space-4);
  display: grid;
  gap: var(--space-2);
  color: var(--color-gray-600);
`

const issueLocationCss = css`
  margin-right: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  color: var(--color-gray-700);
`

const requestIdCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-clear-400);
  border-radius: var(--radius-2);
  background: var(--color-clear-50);
`

const requestIdListCss = css`
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: baseline;
  gap: var(--space-3);
  margin: 0;
`

const requestIdLabelCss = css`
  flex: none;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 600;
`

const requestIdValueCss = css`
  min-width: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  color: var(--color-gray-700);
  overflow-wrap: anywhere;
  /* One click grabs the whole id: it is always copied or read out whole. */
  user-select: all;
`

const actionsRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
`

/** Comfortable gives Retry a row of its own above the other actions. */
const actionsStackCss = css`
  display: grid;
  justify-items: start;
  gap: var(--space-3);
`

/** Compact keeps Retry in one row with the other actions. */
const actionsInRowCss = css`
  display: contents;
`

const linkCss = css`
  color: var(--color-blue-700);

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const detailsPanelCss = css`
  display: grid;
  gap: var(--space-4);
  overflow: auto;
`

const blockLabelCss = css`
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 500;
`

const blockCss = css`
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-2);
  background: var(--color-gray-50);
  color: var(--color-gray-700);
  font-family: var(--font-mono);
  font-size: var(--font-size-1);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

function maxHeightCss(maxHeight: string): string {
  return css`
    max-height: ${maxHeight};
  `
}

function stringifyBlock(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  try {
    return JSON.stringify(value, undefined, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function issueLine(issue: { path?: string | undefined; message: string }): string {
  return issue.path ? `${issue.path}: ${issue.message}` : issue.message
}

/**
 * The clipboard payload of the copy-report button: everything the notice knows, including what is
 * collapsed behind the disclosure, so a reader can paste one block into a bug report instead of
 * transcribing the screen.
 */
function buildErrorReport(args: {
  title: string
  message: string | null
  view: ErrorViewModel
  requestIdLabel: string
  details: DetailRow[]
  blocks: DetailBlock[]
  pageLabel: string
  timeLabel: string
}): string {
  const lines = [args.title]
  if (args.message) {
    lines.push(args.message)
  }
  for (const issue of args.view.issues) {
    lines.push(`- ${issueLine(issue)}`)
  }
  if (args.view.requestId) {
    lines.push(`${args.requestIdLabel}: ${args.view.requestId}`)
  }
  for (const detail of args.details) {
    lines.push(`${detail.label}: ${detail.value}`)
  }
  if (typeof window !== "undefined") {
    lines.push(`${args.pageLabel}: ${window.location.href}`)
  }
  lines.push(`${args.timeLabel}: ${new Date().toISOString()}`)
  for (const block of args.blocks) {
    lines.push("", `${block.label}:`, block.text.replaceAll("\n", `\n${REPORT_INDENT}`))
  }
  return lines.join("\n")
}

/**
 * The failure state of a page or a panel: parses any thrown value, then shows what a reader can
 * act on and hides the rest behind a disclosure. The request id and a one-press bug report are
 * the two things support asks for, so both sit outside the disclosure.
 *
 * For a non-failure notice that explains or warns, use `Infobox` instead.
 */
export const ErrorNotice: React.FC<ErrorNoticeProps> = ({
  error,
  context,
  severity: severityOverride,
  announce = "assertive",
  headingLevel = 2,
  density = "comfortable",
  maxHeight,
  detailsMaxHeight,
  className,
  retry,
  "data-testid": dataTestId,
}) => {
  const { t } = useTranslation("errors")

  const view = useMemo(() => normalizeErrorForDisplay(error, t), [error, t])
  const copy = useMemo(() => resolveErrorDisplayCopy(view, t), [view, t])

  const details = useMemo(() => {
    const technical = view.technicalDetails
    const rows: DetailRow[] = []
    if (view.status !== null) {
      rows.push({ label: t("errorNotice.status"), value: String(view.status) })
    }
    if (view.retryAfterSeconds !== null) {
      rows.push({
        label: t("errorNotice.retryAfter"),
        value: t("errorNotice.seconds", { seconds: view.retryAfterSeconds }),
      })
    }
    if (view.type) {
      rows.push({ label: t("errorNotice.type"), value: view.type })
    }
    if (view.messageKey) {
      rows.push({ label: t("errorNotice.messageKey"), value: view.messageKey })
    }
    if (view.code && view.code !== view.type) {
      rows.push({ label: t("errorNotice.code"), value: view.code })
    }
    if (technical?.method) {
      rows.push({ label: t("errorNotice.method"), value: technical.method })
    }
    if (technical?.url) {
      rows.push({ label: t("errorNotice.url"), value: technical.url })
    }
    return rows
  }, [view, t])

  const blocks = useMemo(() => {
    const technical = view.technicalDetails
    const result: DetailBlock[] = []
    if (technical?.detail) {
      result.push({ label: t("errorNotice.detail"), text: technical.detail })
    }
    if (technical?.stack) {
      result.push({ label: t("errorNotice.stackTrace"), text: technical.stack })
    }
    if (technical?.raw !== undefined) {
      result.push({ label: t("errorNotice.rawResponse"), text: stringifyBlock(technical.raw) })
    }
    return result
  }, [view, t])

  const report = useMemo(
    () =>
      buildErrorReport({
        title: copy.title,
        message: copy.message,
        view,
        requestIdLabel: t("errorNotice.requestId"),
        details,
        blocks,
        pageLabel: t("errorNotice.page"),
        timeLabel: t("errorNotice.time"),
      }),
    [copy, view, details, blocks, t],
  )

  const registerTitle = useContext(ErrorNoticeTitleContext)
  const pageTitle = headingLevel === 1 ? copy.title : null
  useLayoutEffect(() => {
    if (registerTitle === null || pageTitle === null) {
      return
    }
    registerTitle(pageTitle)
    return () => registerTitle(null)
  }, [registerTitle, pageTitle])

  const showRetry = retry !== undefined && !isNonRetryableStatus(view.status)
  const severity = severityOverride ?? view.severity
  const SeverityIcon = SEVERITY_ICONS[severity]
  const HeadingTag = `h${headingLevel}` as "h1" | "h2" | "h3" | "h4"
  // Several backend payloads carry the same string as both title and message.
  const message = copy.message === copy.title ? null : copy.message
  const isCompact = density === COMPACT_DENSITY

  // A lone copy link fits beside the title; with Retry or "Go to error" the actions stay one row.
  const isCopyBesideTitle = isCompact && !showRetry && !view.blockId

  const header = (
    <div className={cx(headerCss, isCompact && compactHeaderCss)}>
      <span
        className={cx(iconCss, iconSeverityCss[severity], isCompact && compactIconCss)}
        aria-hidden="true"
      >
        <SeverityIcon size={ICON_SIZE[density]} />
      </span>
      <HeadingTag className={cx(titleCss, isCompact && compactTitleCss)}>{copy.title}</HeadingTag>
    </div>
  )

  const summaryText = (
    <>
      {context ? <div className={paragraphCss}>{context}</div> : null}
      {message ? <p className={paragraphCss}>{message}</p> : null}
    </>
  )

  const actions = (
    <div
      className={cx(
        isCompact ? actionsRowCss : actionsStackCss,
        isCopyBesideTitle && compactActionsBesideTitleCss,
      )}
    >
      {showRetry ? (
        <Button type="button" variant="secondary" size="small" onPress={retry}>
          {t("errorNotice.retry")}
        </Button>
      ) : null}
      <div className={isCompact ? actionsInRowCss : actionsRowCss}>
        <CopyButton
          value={report}
          label={t("errorNotice.copyReport")}
          appearance={COPY_BUTTON_APPEARANCE[density]}
        >
          {t("errorNotice.copyReport")}
        </CopyButton>
        {view.blockId ? (
          <a className={linkCss} href={`#${view.blockId}`}>
            {t("go-to-error")}
          </a>
        ) : null}
      </div>
    </div>
  )

  const body = (
    <>
      {view.issues.length > 0 ? (
        <ul className={issuesCss}>
          {view.issues.map((issue, index) => (
            <li key={`${issue.path ?? issue.code ?? ""}-${index}`}>
              {issue.path ? <code className={issueLocationCss}>{issue.path}</code> : null}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      {view.requestId ? (
        <div className={requestIdCss}>
          <dl className={requestIdListCss}>
            <dt className={requestIdLabelCss}>{t("errorNotice.requestId")}</dt>
            <dd className={requestIdValueCss} data-mask-over-this-in-system-tests="true">
              {view.requestId}
            </dd>
          </dl>
        </div>
      ) : null}
      {isCopyBesideTitle ? null : actions}

      {details.length > 0 || blocks.length > 0 ? (
        <Disclosure title={t("errorNotice.technicalDetails")}>
          <div
            className={cx(
              detailsPanelCss,
              detailsMaxHeight === undefined ? undefined : maxHeightCss(detailsMaxHeight),
            )}
          >
            {details.length > 0 ? <DescriptionList items={details} /> : null}
            {blocks.map((block) => (
              <div key={block.label}>
                <span className={blockLabelCss}>{block.label}</span>
                <pre className={blockCss}>{block.text}</pre>
              </div>
            ))}
          </div>
        </Disclosure>
      ) : null}
    </>
  )

  const compactSummary = (
    <div className={compactSummaryCss}>
      {header}
      <div className={cx(compactIndentCss, compactSummaryTextCss)}>{summaryText}</div>
    </div>
  )

  return (
    <div
      className={cx(
        rootCss,
        densityCss[density],
        severityCss[severity],
        isCompact && compactSeverityBorderCss[severity],
        maxHeight === undefined ? undefined : maxHeightCss(maxHeight),
        className,
      )}
      role={ANNOUNCEMENT_ROLES[announce]}
      data-testid={dataTestId}
    >
      {isCompact ? (
        <>
          {isCopyBesideTitle ? (
            <div className={compactSummaryRowCss}>
              {compactSummary}
              {actions}
            </div>
          ) : (
            compactSummary
          )}
          <div className={cx(compactIndentCss, compactBodyCss)}>{body}</div>
        </>
      ) : (
        <>
          {header}
          {summaryText}
          {body}
        </>
      )}
    </div>
  )
}
