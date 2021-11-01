import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../../.."
import { FileAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import Button from "../../../../../shared-module/components/Button"
import ExternalLinkSVG from "../../../../../shared-module/img/external-link.svg"
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"

const FileBlock: React.FC<BlockRendererProps<FileAttributes>> = ({ data }) => {
  const { t } = useTranslation()
  const {
    showDownloadButton,
    // previewHeight,
    // align,
    anchor,
    // className,
    // displayPreview,
    downloadButtonText,
    fileName,
    href,
    // textLinkHref,
    textLinkTarget,
  } = data.attributes
  return (
    <div
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      <span>
        <a
          href={href}
          {...(textLinkTarget && { target: textLinkTarget })}
          {...(anchor && { id: anchor })}
          rel="noopener"
        >
          {fileName}
          {textLinkTarget === "_blank" && (
            <div>
              <span className="screen-reader-only">{t("screen-reader-opens-in-new-tab")}</span>
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

export default FileBlock
