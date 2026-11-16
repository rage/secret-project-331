"use client"

import { InspectorControls } from "@wordpress/block-editor"
import { PanelBody, ToggleControl } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

import { useTranslation } from "@/utils/useCmsTranslation"

import { useIsBlockPreviewMode } from "./blockPreviewMode"
import { hasRowHeaders, setRowHeaders, type TableBodyAttributes } from "./tableRowHeaders"

const TABLE_BLOCK_NAME = "core/table"

interface TableEditProps {
  name: string
  attributes: TableBodyAttributes
  setAttributes: (attributes: Record<string, unknown>) => void
  [key: string]: unknown
}

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withTableRowHeaders = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
  const TableRowHeaders = (props: TableEditProps) => {
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
  const BlockEditWithTableRowHeaders = (props: TableEditProps) =>
    props.name === TABLE_BLOCK_NAME ? <TableRowHeaders {...props} /> : <BlockEdit {...props} />

  return BlockEditWithTableRowHeaders
  // oxlint-disable-next-line i18next/no-literal-string
}, "withTableRowHeaders")

export default withTableRowHeaders
