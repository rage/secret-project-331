"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { FileAttributes } from "@/../types/GutenbergBlockAttributes"
import ExternalLinkSVG from "@/shared-module/common/img/external-link.svg"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link } from "@/shared-module/components"
import { richTextToPlainText } from "@/utils/course-material/richTextToPlainText"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

import type { BlockRendererProps } from "../../.."
import { OpensInNewTabNotice, relForLinkTarget } from "../../../util/links"

const FileBlock: React.FC<React.PropsWithChildren<BlockRendererProps<FileAttributes>>> = ({
  data,
}) => {
  const { t } = useTranslation()
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
  const fileNameText = richTextToPlainText(fileName ?? "")
  return (
    <div>
      <span>
        <a
          href={href}
          {...(textLinkTarget && { target: textLinkTarget })}
          rel={relForLinkTarget(undefined, textLinkTarget)}
        >
          <span dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(fileName) }} />
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
          <Link
            href={href ?? ""}
            isDisabled={!href}
            download={fileNameText}
            styledAsButton
            size="medium"
            variant="tertiary"
            {...(!downloadButtonText && {
              "aria-label": t("download-file", { fileName: fileNameText }),
            })}
          >
            {downloadButtonText && (
              <span
                dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(downloadButtonText) }}
              />
            )}
          </Link>
        </span>
      )}
    </div>
  )
}

export default withErrorBoundary(FileBlock)
