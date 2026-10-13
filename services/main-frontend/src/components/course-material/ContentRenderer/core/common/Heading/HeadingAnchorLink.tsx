"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle, Link, XmarkCircle } from "@vectopus/atlas-icons-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { copyTextToClipboard } from "@/shared-module/common/hooks/useCopyToClipboard"
import { baseTheme } from "@/shared-module/common/styles"

/** Lets the heading reveal its own anchor link on hover. */
export const HEADING_ANCHOR_LINK_CLASS = "heading-anchor-link"

const COPY_STATUS = {
  DEFAULT: "default",
  SUCCESS: "success",
  ERROR: "error",
} as const

type CopyStatus = (typeof COPY_STATUS)[keyof typeof COPY_STATUS]

const FEEDBACK_VISIBLE_MS = 2000
const ICON_SIZE_PX = 16

/* Takes no space, so the icon never wraps onto a line of its own or makes a line taller. At the end of
   a full line the icon hangs into the margin instead. */
const slotStyles = css`
  display: inline-block;
  position: relative;
  width: 0;
  height: 0;
  vertical-align: middle;
`

const linkStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 0.4rem;
  transform: translateY(-50%);
  padding: 4px;
  border-radius: 4px;
  color: ${baseTheme.colors.gray[500]};
  opacity: 0;
  transition:
    opacity 0.15s,
    color 0.15s;

  &:hover {
    color: ${baseTheme.colors.green[600]};
  }

  &:focus-visible {
    opacity: 1;
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }

  &[data-status="success"],
  &[data-status="error"] {
    opacity: 1;
  }

  /* Without a pointer there is nothing to hover with, so the icon has to stay visible. */
  @media (hover: none) {
    opacity: 1;
  }
`

const tooltipStyles = css`
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background-color: ${baseTheme.colors.gray[700]};
  color: ${baseTheme.colors.primary[100]};
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  pointer-events: none;

  &[data-show="true"] {
    display: block;
  }
`

interface HeadingAnchorLinkProps {
  anchorId: string
  /** The heading's own text, so that the link's accessible name says which section it points at. */
  headingText: string
}

/**
 * The copy-link icon shown beside a course material heading.
 *
 * A real link rather than a button, so that opening it in a new tab and the browser's own
 * "copy link address" keep working. A plain click copies the absolute link instead of navigating,
 * because the reader is already looking at the heading they clicked.
 */
const HeadingAnchorLink: React.FC<HeadingAnchorLinkProps> = ({ anchorId, headingText }) => {
  const { t } = useTranslation()
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(COPY_STATUS.DEFAULT)

  useEffect(() => {
    if (copyStatus === COPY_STATUS.DEFAULT) {
      return undefined
    }
    const timer = setTimeout(() => setCopyStatus(COPY_STATUS.DEFAULT), FEEDBACK_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [copyStatus])

  const handleClick = useCallback(async (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks mean the reader wants the browser's own behaviour, e.g. a new tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    const url = event.currentTarget.href
    // Reflects the section in the address bar without the jump that following the link would cause.
    window.history.replaceState(null, "", url)
    // Lets a copy made while success already shows restart the timer and be announced.
    setCopyStatus(COPY_STATUS.DEFAULT)
    const copied = await copyTextToClipboard(url)
    setCopyStatus(copied ? COPY_STATUS.SUCCESS : COPY_STATUS.ERROR)
  }, [])

  const statusMessage =
    copyStatus === COPY_STATUS.SUCCESS
      ? t("copied")
      : copyStatus === COPY_STATUS.ERROR
        ? t("copying-failed")
        : ""

  return (
    <>
      <span className={slotStyles}>
        <a
          href={`#${anchorId}`}
          onClick={handleClick}
          className={cx(HEADING_ANCHOR_LINK_CLASS, linkStyles)}
          data-status={copyStatus}
          aria-label={t("copy-link-to-section", { heading: headingText })}
        >
          {copyStatus === COPY_STATUS.SUCCESS ? (
            <CheckCircle size={ICON_SIZE_PX} />
          ) : copyStatus === COPY_STATUS.ERROR ? (
            <XmarkCircle size={ICON_SIZE_PX} />
          ) : (
            <Link size={ICON_SIZE_PX} />
          )}
          <span className={tooltipStyles} data-show={statusMessage !== ""} aria-hidden="true">
            {statusMessage}
          </span>
        </a>
      </span>
      {/* Rendered even while empty: a live region has to be in the accessibility tree before its
          content changes, or the change goes unannounced. */}
      <span role="status" className="screen-reader-only">
        {statusMessage}
      </span>
    </>
  )
}

export default HeadingAnchorLink
