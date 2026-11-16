"use client"

import { InspectorControls } from "@wordpress/block-editor"
import { Notice, PanelBody, ToggleControl } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"
import { hasRowHeaders, setRowHeaders, type TableBodyAttributes } from "./tableRowHeaders"

const MEDIA_BLOCK_NAMES = ["core/audio", "core/video"]
const TABLE_BLOCK_NAME = "core/table"
const WARNING_NOTICE_STATUS = "warning"

interface BlockEditProps {
  name: string
  attributes: { autoplay?: boolean } & TableBodyAttributes
  setAttributes: (attributes: Record<string, unknown>) => void
  [key: string]: unknown
}

// Media autoplay warning and table row-header toggle as one `editor.BlockEdit` filter.
// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withAccessibilityInspectors = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const MediaAutoplayWarning = (props: BlockEditProps) => {
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
  const TableRowHeaders = (props: BlockEditProps) => {
    const { t } = useTranslation()
    const isPreviewMode = useIsBlockPreviewMode()
    return (
      <Fragment>
        <BlockEdit {...props} />
        {!isPreviewMode && (
          <InspectorControls>
            <PanelBody title={t("first-column-row-headers")} initialOpen={true}>
              <ToggleControl
                label={t("first-column-row-headers")}
                checked={hasRowHeaders(props.attributes.body)}
                onChange={(enabled: boolean) =>
                  props.setAttributes({ body: setRowHeaders(props.attributes.body, enabled) })
                }
              />
            </PanelBody>
          </InspectorControls>
        )}
      </Fragment>
    )
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const BlockEditWithAccessibilityInspectors = (props: BlockEditProps) => {
    if (MEDIA_BLOCK_NAMES.includes(props.name)) {
      return <MediaAutoplayWarning {...props} />
    }
    if (props.name === TABLE_BLOCK_NAME) {
      return <TableRowHeaders {...props} />
    }
    return <BlockEdit {...props} />
  }

  return BlockEditWithAccessibilityInspectors
  // oxlint-disable-next-line i18next/no-literal-string
}, "withAccessibilityInspectors")

export default withAccessibilityInspectors
