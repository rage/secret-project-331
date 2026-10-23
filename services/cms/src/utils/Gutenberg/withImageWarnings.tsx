"use client"

import { css } from "@emotion/css"
import { Notice } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

import { Link } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"
import { shouldWarnAboutImageAltPlaceholder } from "./imageAltWarning"

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
type ImageWarningKey = "warning-image-alt-placeholder"
const IMAGE_ALT_WARNING_KEY: ImageWarningKey = "warning-image-alt-placeholder"
// oxlint-disable-next-line i18next/no-literal-string
const W3C_ALT_DECISION_TREE_URL = "https://www.w3.org/WAI/tutorials/images/decision-tree/"
const WARNING_NOTICE_STATUS = "warning"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withImageWarnings = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const ImageWarnings = (props: ImageBlockProps) => {
    const { t } = useTranslation()
    const isPreviewMode = useIsBlockPreviewMode()

    const warningKeys: ImageWarningKey[] =
      !isPreviewMode &&
      shouldWarnAboutImageAltPlaceholder(props.attributes?.alt, props.attributes?.isDecorative)
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
                  <Link href={W3C_ALT_DECISION_TREE_URL} target="_blank" rel="noopener noreferrer">
                    {t("link-image-alt-decision-tree")}
                  </Link>
                </p>
              </Notice>
            ))}
          </div>
        )}
      </Fragment>
    )
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const BlockEditWithImageWarnings = (props: ImageBlockProps) =>
    props.name === IMAGE_BLOCK_NAME ? <ImageWarnings {...props} /> : <BlockEdit {...props} />

  return BlockEditWithImageWarnings
  // oxlint-disable-next-line i18next/no-literal-string
}, "withImageWarnings")

export default withImageWarnings
