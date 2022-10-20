import { css } from "@emotion/css"
import { BlockIcon } from "@wordpress/block-editor"
import { PanelBody, Placeholder, TextControl } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

interface RequiredAttributes {
  width: string | number
}

export interface TableBoxWidthCustomizerProps {
  attributes: RequiredAttributes
  setAttributes: (attributes: Partial<RequiredAttributes>) => void
}

const TableBoxWidthCustomizer: React.FC<React.PropsWithChildren<TableBoxWidthCustomizerProps>> = ({
  attributes,
  setAttributes,
}) => {
  const { width } = attributes
  const { t } = useTranslation()
  return (
    <PanelBody title={t("table-width-customizer")} initialOpen={false}>
      <Placeholder
        className={placeHolderFixHeightStyles}
        icon={<BlockIcon icon={icon} />}
        label={t("table-width-customizer")}
      >
        <TextControl
          label={t("width-of-table")}
          value={width}
          onChange={(value: string) => setAttributes({ width: value })}
        />
      </Placeholder>
    </PanelBody>
  )
}

export default TableBoxWidthCustomizer
