import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import TableBoxWidthCustomizer from "../../components/blocks/TableBoxWidthCustomizer"
import BlockWrapper from "../BlockWrapper"

import { TableBoxAttributes } from "."

import { baseTheme, headingFont } from "@/shared-module/common/styles"

const ALLOWED_NESTED_BLOCKS = ["core/table"]

const TABLE_TEMPLATE: Template[] = [["core/table", { title: "TableBox" }]]

const TableEditor: React.FC<React.PropsWithChildren<BlockEditProps<TableBoxAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="tablebox-settings">
        <TableBoxWidthCustomizer attributes={attributes} setAttributes={setAttributes} />
      </InspectorControls>
      <div>
        <div
          className={css`
            padding: 1rem;
            background: #ecf3f2;
            text-align: center;
            font-family: ${headingFont};
          `}
        >
          <h4>{t("table-box")}</h4>
          <span
            className={css`
              color: ${baseTheme.colors.green[600]};
              text-align: center;
              font-weight: 600;
              font-family: ${headingFont};
            `}
          >
            {t("table-box-description")}
          </span>
        </div>
        <InnerBlocks
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
          template={TABLE_TEMPLATE}
          templateLock="all"
        />
      </div>
    </BlockWrapper>
  )
}

export default TableEditor
