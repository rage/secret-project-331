"use client"

import { css } from "@emotion/css"
import { BlockIcon } from "@wordpress/block-editor"
import { PanelBody, Placeholder } from "@wordpress/components"
import { cover as icon } from "@wordpress/icons"
import React from "react"

import { Radio, RadioGroup } from "@/shared-module/components"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

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
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const { control } = useAttributeForm({ size: attributes.size }, ({ size }) =>
    setAttributes({ size }),
  )
  return (
    <PanelBody title={t("flip-card-size-customizer")} initialOpen={false}>
      <Placeholder
        className={placeHolderFixHeightStyles}
        icon={<BlockIcon icon={icon} />}
        label={t("flip-card-size-customizer")}
      >
        <RadioGroup name="size" control={control} label={t("flip-card-size-customizer")}>
          {/* oxlint-disable i18next/no-literal-string */}
          <Radio value="xl" label="Xl (500x500)" />
          <Radio value="m" label="M (300x300)" />
          <Radio value="s" label="S (200x200)" />
          {/* oxlint-enable i18next/no-literal-string */}
        </RadioGroup>
      </Placeholder>
    </PanelBody>
  )
}

export default FlipBoxSizeCustomizer
