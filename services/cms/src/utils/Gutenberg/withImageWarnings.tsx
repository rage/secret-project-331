"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"
import { useTranslation } from "react-i18next"

import { shouldWarnAboutImageAltPlaceholder } from "./imageAltWarning"

interface ImageBlockProps {
  name: string
  attributes: {
    alt?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

const IMAGE_BLOCK_NAME = "core/image"
type ImageWarningKey = "warning-image-alt-placeholder"
const IMAGE_ALT_WARNING_KEY: ImageWarningKey = "warning-image-alt-placeholder"
// eslint-disable-next-line i18next/no-literal-string
const W3C_ALT_DECISION_TREE_URL = "https://www.w3.org/WAI/tutorials/images/decision-tree/"
const WARNING_NOTICE_STATUS = "warning"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withImageWarnings = createHigherOrderComponent((BlockEdit) => {
  const ImageWithWarnings = (props: ImageBlockProps) => {
    const { t } = useTranslation()

    if (props.name !== IMAGE_BLOCK_NAME) {
      return <BlockEdit {...props} />
    }

    const warningKeys: ImageWarningKey[] = shouldWarnAboutImageAltPlaceholder(props.attributes?.alt)
      ? [IMAGE_ALT_WARNING_KEY]
      : []

    return (
      <Fragment>
        <BlockEdit {...props} />
        {warningKeys.length > 0 && (
          <div
            className={css`
              margin-top: 0.75rem;
            `}
          >
            {warningKeys.map((warningKey) => (
              <Notice key={warningKey} status={WARNING_NOTICE_STATUS} isDismissible={false}>
                <p>{t(warningKey)}</p>
                <p>
                  {t("warning-image-alt-placeholder-guidance")}{" "}
                  <a href={W3C_ALT_DECISION_TREE_URL} target="_blank" rel="noopener noreferrer">
                    {t("link-image-alt-decision-tree")}
                  </a>
                </p>
              </Notice>
            ))}
          </div>
        )}
      </Fragment>
    )
  }

  ImageWithWarnings.displayName = "ImageWarnings"
  return ImageWithWarnings
  // eslint-disable-next-line i18next/no-literal-string
}, "withImageWarnings")

export default withImageWarnings
