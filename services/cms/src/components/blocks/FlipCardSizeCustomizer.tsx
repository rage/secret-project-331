/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { BlockIcon } from "@wordpress/block-editor"
import { PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"
import { useTranslation } from "react-i18next"

import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"

const placeHolderFixHeightStyles = css`
  min-height: unset !important;
  margin-bottom: 1rem !important;
`

interface RequiredAttributes {
  size: string
}

export interface FlipCardCustomizerProps {
  attributes: RequiredAttributes
  setAttributes: (attributes: Partial<RequiredAttributes>) => void
}

const FlipBoxSizeCustomizer: React.FC<React.PropsWithChildren<FlipCardCustomizerProps>> = ({
  setAttributes,
}) => {
  const { t } = useTranslation()
  return (
    <PanelBody title={t("flip-card-size-customizer")} initialOpen={false}>
      <Placeholder
        className={placeHolderFixHeightStyles}
        icon={<BlockIcon icon={icon} />}
        label={t("flip-card-size-customizer")}
      >
        <RadioButton
          label={"Xl (500x500)"}
          name={t("flip-card-size-customizer")}
          onChange={() => setAttributes({ size: "xl" })}
        />
        <RadioButton
          label={"M (300x300)"}
          name={t("flip-card-size-customizer")}
          onChange={() => setAttributes({ size: "m" })}
        />
        <RadioButton
          label={"S (200x200)"}
          name={t("flip-card-size-customizer")}
          onChange={() => setAttributes({ size: "s" })}
        />
      </Placeholder>
    </PanelBody>
  )
}

export default FlipBoxSizeCustomizer
