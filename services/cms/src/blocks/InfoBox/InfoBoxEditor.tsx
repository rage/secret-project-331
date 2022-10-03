import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../shared-module/components/Centering/Centered"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"
import BlockWrapper from "../BlockWrapper"

import { InfoBoxComponentProps } from "."

const InfoBoxEditor: React.FC<React.PropsWithChildren<BlockEditProps<InfoBoxComponentProps>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          // eslint-disable-next-line i18next/no-literal-string
          defaultBackgroundColor="#faf5f3"
        />
      </InspectorControls>
      <BreakFromCentered {...breakFromCenteredProps}>
        <div
          className={css`
            padding: 3rem;
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
