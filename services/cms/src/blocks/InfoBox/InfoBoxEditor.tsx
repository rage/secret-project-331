"use client"

import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import React from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import { Checkbox } from "@/shared-module/components"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { InfoBoxComponentProps } from "."
import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"
import BlockWrapper from "../BlockWrapper"

const InfoBoxEditor: React.FC<React.PropsWithChildren<BlockEditProps<InfoBoxComponentProps>>> = ({
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const { control } = useAttributeForm(
    { noPadding: Boolean(attributes.noPadding) },
    ({ noPadding }) => setAttributes({ noPadding }),
  )
  return (
    <BlockWrapper>
      <InspectorControls key="settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          defaultBackgroundColor="#faf5f3"
        />

        <div
          className={css`
            margin: 1rem;
            margin-bottom: 1.5rem;
          `}
        >
          <Checkbox name="noPadding" control={control} label={t("label-no-padding")} />
        </div>
      </InspectorControls>
      <BreakFromCentered {...breakFromCenteredProps}>
        <div
          className={css`
            ${!attributes.noPadding && `padding: 3rem;`}
            background-color: ${attributes.backgroundColor};
          `}
        >
          <Centered variant="narrow">
            <div
              className={css`
                padding: 10px;
              `}
            >
              <InnerBlocks />
            </div>
          </Centered>
        </div>
      </BreakFromCentered>
    </BlockWrapper>
  )
}

export default InfoBoxEditor
