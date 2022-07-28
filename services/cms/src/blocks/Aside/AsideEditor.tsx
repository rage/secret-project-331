import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import BlockWrapper from "../BlockWrapper"

import { AsideComponentProps } from "."

const AsideEditor: React.FC<React.PropsWithChildren<BlockEditProps<AsideComponentProps>>> = ({
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
          defaultBackgroundColor="#ebf5fb"
        />
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          // eslint-disable-next-line i18next/no-literal-string
          defaultBackgroundColor="#007acc"
          // eslint-disable-next-line i18next/no-literal-string
          customAttributeName="separatorColor"
          customTitle={t("separator-color")}
        />
      </InspectorControls>
      <div
        className={css`
          padding: 2rem;
          border-top: 0.4rem solid ${attributes.separatorColor};
          border-bottom: 0.4rem solid ${attributes.separatorColor};
          background: ${attributes.backgroundColor};
          margin: 3rem 0;
        `}
      >
        <InnerBlocks />
      </div>
    </BlockWrapper>
  )
}

export default AsideEditor
