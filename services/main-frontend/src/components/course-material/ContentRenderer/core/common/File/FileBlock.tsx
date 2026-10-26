"use client"

import { css } from "@emotion/css"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type { FileAttributes } from "@/../types/GutenbergBlockAttributes"
import ExternalLinkSVG from "@/shared-module/common/img/external-link.svg"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link } from "@/shared-module/components"

import type { BlockRendererProps } from "../../.."
import { OpensInNewTabNotice, relForLinkTarget } from "../../../util/links"

/**
 * The file route serves `download=1` as an attachment saved as `name` plus the stored file's
 * extension. The `download` attribute alone is not enough: browsers ignore it once the route
 * redirects to storage on another origin.
 */
function attachmentHref(href: string, name: string): string {
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) {
    return href
  }
  // oxlint-disable-next-line i18next/no-literal-string
  url.searchParams.set("download", "1")
  // oxlint-disable-next-line i18next/no-literal-string
  url.searchParams.set("name", name)
  return url.toString()
}

const FileBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FileAttributes>>> = ({
  data,
}) => {
  const { t } = useTranslation()
  const {
    showDownloadButton,
    previewHeight,
    displayPreview,
    downloadButtonText,
    fileName,
    href,
    // textLinkHref,
    textLinkTarget: storedTextLinkTarget,
  } = data.attributes
  // Gutenberg stores `false`, not an absent attribute, once "Open in new tab" is switched off.
  const textLinkTarget = (storedTextLinkTarget as string | false | undefined) || undefined
  // Gutenberg offers the embed only for PDFs; anything else in an unsandboxed frame could run.
  const isPdf = /\.pdf$/i.test(href?.split(/[?#]/)[0] ?? "")
  // window and DOMParser are unavailable during server rendering.
  const [downloadHref, setDownloadHref] = useState(href)
  useEffect(() => {
    const plainFileName =
      // oxlint-disable-next-line i18next/no-literal-string
      new DOMParser().parseFromString(fileName ?? "", "text/html").body.textContent ?? ""
    setDownloadHref(href && attachmentHref(href, plainFileName))
  }, [href, fileName])

  return (
    <div>
      {displayPreview &&
        isPdf && (
          // Not an <object>: the CSP blocks plugins. Not sandboxed: Chromium refuses PDFs in sandboxes.
          // oxlint-disable-next-line react/iframe-missing-sandbox
          <iframe
            src={href}
            title={t("file-preview", { fileName })}
            className={css`
              display: block;
              width: 100%;
              height: ${previewHeight ?? 600}px;
              margin-bottom: var(--space-3);
              border: 1px solid var(--color-gray-100);
              border-radius: var(--surface-radius);
            `}
          />
        )}
      <span>
        <a
          href={href}
          {...(textLinkTarget && { target: textLinkTarget })}
          rel={relForLinkTarget(undefined, textLinkTarget)}
        >
          {fileName}
          {textLinkTarget?.includes("_blank") && (
            <div>
              <OpensInNewTabNotice linkTarget={textLinkTarget} />
              <ExternalLinkSVG />
            </div>
          )}
        </a>
      </span>
      {showDownloadButton && (
        <span
          className={css`
            padding: 0 1rem;
          `}
        >
          <Link
            href={downloadHref ?? ""}
            isDisabled={!href}
            download={fileName}
            styledAsButton
            size="medium"
            variant="tertiary"
            {...(!downloadButtonText && { "aria-label": t("download-file", { fileName }) })}
          >
            {downloadButtonText}
          </Link>
        </span>
      )}
    </div>
  )
}

export default withErrorBoundary(FileBlock)
