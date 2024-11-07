import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BackgroundColorCustomizer from "../../components/blocks/BackgroundColorCustomizer"
import BlockWrapper from "../BlockWrapper"

import { TerminologyBlockAttributes } from "."

import { primaryFont } from "@/shared-module/common/styles"

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/paragraph", "core/list"]
const LANDING_PAGE_HERO_SECTION_TEMPLATE: Template[] = [
  ["core/paragraph", { content: "Insert body text...", placeholder: "Insert body text..." }],
]

const TerminologyBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<TerminologyBlockAttributes>>
> = ({ clientId, attributes, setAttributes }) => {
  const { title, blockName } = attributes
  const { t } = useTranslation()

  return (
    <BlockWrapper id={clientId}>
      <InspectorControls key="settings">
        <BackgroundColorCustomizer
          attributes={attributes}
          setAttributes={setAttributes}
          // eslint-disable-next-line i18next/no-literal-string
          defaultBackgroundColor="rgb(53, 63, 75)"
          // eslint-disable-next-line i18next/no-literal-string
          customAttributeName="primaryColor"
          customTitle={t("primary-color")}
        />
      </InspectorControls>
      <div
        className={css`
          box-shadow: rgba(0, 0, 0, 0.08) 0px 2px 12px 0px;
          margin: 3rem 0;
        `}
      >
        <div
          className={css`
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 32px 32px 64px 32px;
            border-left: 8px solid ${attributes.primaryColor};

            p {
              color: rgb(53, 63, 75);
              font-size: 16px;
            }

            h2 {
              margin-top: 20px;
              color: #1a2333;
              font-weight: 650;
              font-family: ${primaryFont};
              margin-bottom: 0rem;
              font-size: 30px;
            }
          `}
        >
          <RichText
            className={css`
              font-size: 16px;
              color: ${attributes.primaryColor} !important;
            `}
            // eslint-disable-next-line i18next/no-literal-string
            tagName="p"
            value={blockName}
            onChange={(value: string) => setAttributes({ blockName: value })}
            placeholder={t("terminology")}
          />
          <RichText
            // eslint-disable-next-line i18next/no-literal-string
            tagName="h2"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={t("welcome-message-for-course")}
          />
          <InnerBlocks
            template={LANDING_PAGE_HERO_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
          />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default TerminologyBlockEditor
