"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

import { Link } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"
import { isGoogleDocsImageUrl, shouldWarnAboutImageAltPlaceholder } from "./imageAltWarning"

interface ImageBlockProps {
  name: string
  attributes: {
    alt?: string
    isDecorative?: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

const IMAGE_BLOCK_NAME = "core/image"
// oxlint-disable-next-line i18next/no-literal-string
const W3C_ALT_DECISION_TREE_URL = "https://www.w3.org/WAI/tutorials/images/decision-tree/"
const WARNING_NOTICE_STATUS = "warning"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withImageWarnings = createHigherOrderComponent((BlockEdit) => {
  const ImageWarnings = (props: ImageBlockProps) => {
    const { t } = useTranslation()
    const isPreviewMode = useIsBlockPreviewMode()

    const showGoogleDocsWarning = !isPreviewMode && isGoogleDocsImageUrl(props.attributes?.url)
    const showAltWarning =
      !isPreviewMode &&
      shouldWarnAboutImageAltPlaceholder(props.attributes?.alt, props.attributes?.isDecorative)

    return (
      <Fragment>
        <BlockEdit {...props} />
        {(showGoogleDocsWarning || showAltWarning) && (
          <div
            className={css`
              margin-top: 0.75rem;
            `}
          >
            {showGoogleDocsWarning && (
              <Notice status={WARNING_NOTICE_STATUS} isDismissible={false}>
                <p>{t("warning-image-google-docs")}</p>
              </Notice>
            )}
            {showAltWarning && (
              <Notice status={WARNING_NOTICE_STATUS} isDismissible={false}>
                <p>{t("warning-image-alt-placeholder")}</p>
                <p>
                  {t("warning-image-alt-placeholder-guidance")}{" "}
                  <Link href={W3C_ALT_DECISION_TREE_URL} target="_blank" rel="noopener noreferrer">
                    {t("link-image-alt-decision-tree")}
                  </Link>
                </p>
              </Notice>
            )}
          </div>
        )}
      </Fragment>
    )
  }

  const BlockEditWithImageWarnings = (props: ImageBlockProps) =>
    props.name === IMAGE_BLOCK_NAME ? <ImageWarnings {...props} /> : <BlockEdit {...props} />

  return BlockEditWithImageWarnings
  // oxlint-disable-next-line i18next/no-literal-string
}, "withImageWarnings")

export default withImageWarnings
