"use client"

import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"

import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { AsideComponentProps } from "."
import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import BlockWrapper from "../BlockWrapper"

const AsideEditor = ({
  clientId,
  attributes,
  setAttributes,
}: BlockEditProps<AsideComponentProps>): JSX.Element => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          defaultBackgroundColor="#ebf5fb"
        />
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          defaultBackgroundColor="#007acc"
          // oxlint-disable-next-line i18next/no-literal-string
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
