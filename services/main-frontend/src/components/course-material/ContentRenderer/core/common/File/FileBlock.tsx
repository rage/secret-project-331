"use client"

import { css } from "@emotion/css"

import type { FileAttributes } from "@/../types/GutenbergBlockAttributes"
import Button from "@/shared-module/common/components/Button"
import ExternalLinkSVG from "@/shared-module/common/img/external-link.svg"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../../.."
import { OpensInNewTabNotice, relForLinkTarget } from "../../../util/links"

const FileBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FileAttributes>>> = ({
  data,
}) => {
  const {
    showDownloadButton,
    // previewHeight,
    // align,
    // className,
    // displayPreview,
    downloadButtonText,
    fileName,
    href,
    // textLinkHref,
    textLinkTarget,
  } = data.attributes
  return (
    <div>
      <span>
        <a
          href={href}
          {...(textLinkTarget && { target: textLinkTarget })}
          rel={relForLinkTarget(undefined, textLinkTarget)}
        >
          {fileName}
          {textLinkTarget && textLinkTarget.includes("_blank") && (
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
          <a href={href} download={fileName}>
            <Button size="medium" variant="tertiary">
              {downloadButtonText}
            </Button>
          </a>
        </span>
      )}
    </div>
  )
}

export default withErrorBoundary(FileBlock)
