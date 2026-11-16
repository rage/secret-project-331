"use client"

import { InspectorControls } from "@wordpress/block-editor"
import { Notice, PanelBody } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"

const MEDIA_BLOCK_NAMES = ["core/audio", "core/video"]
const WARNING_NOTICE_STATUS = "warning"

interface MediaEditProps {
  name: string
  attributes: { autoplay?: boolean }
  [key: string]: unknown
}

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withMediaAutoplayWarning = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const MediaAutoplayWarning = (props: MediaEditProps) => {
    const { t } = useTranslation()
    const isPreviewMode = useIsBlockPreviewMode()
    return (
      <Fragment>
        <BlockEdit {...props} />
        {!isPreviewMode && props.attributes?.autoplay && (
          <InspectorControls>
            <PanelBody title={t("accessibility")} initialOpen={true}>
              <Notice status={WARNING_NOTICE_STATUS} isDismissible={false}>
                <p>{t("warning-media-autoplay")}</p>
              </Notice>
            </PanelBody>
          </InspectorControls>
        )}
      </Fragment>
    )
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const BlockEditWithMediaAutoplayWarning = (props: MediaEditProps) =>
    MEDIA_BLOCK_NAMES.includes(props.name) ? (
      <MediaAutoplayWarning {...props} />
    ) : (
      <BlockEdit {...props} />
    )

  return BlockEditWithMediaAutoplayWarning
  // oxlint-disable-next-line i18next/no-literal-string
}, "withMediaAutoplayWarning")

export default withMediaAutoplayWarning
