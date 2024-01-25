import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import BreakFromCentered from "../../shared-module/common/components/Centering/BreakFromCentered"
import Centered from "../../shared-module/common/components/Centering/Centered"
import CheckBox from "../../shared-module/common/components/InputFields/CheckBox"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"
import BlockWrapper from "../BlockWrapper"

import { InfoBoxComponentProps } from "."

const InfoBoxEditor: React.FC<React.PropsWithChildren<BlockEditProps<InfoBoxComponentProps>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          // eslint-disable-next-line i18next/no-literal-string
          defaultBackgroundColor="#faf5f3"
        />

        <div
          className={css`
            margin: 1rem;
            margin-bottom: 1.5rem;
          `}
        >
          <CheckBox
            checked={attributes.noPadding}
            onChange={(event) => setAttributes({ noPadding: event.target.checked })}
            label={t("label-no-padding")}
          />
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
