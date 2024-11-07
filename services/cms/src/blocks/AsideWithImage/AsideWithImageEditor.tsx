import { css } from "@emotion/css"
import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockWrapper from "../BlockWrapper"

import { AsideWithImageBlockAttributes } from "."

import { baseTheme, headingFont } from "@/shared-module/common/styles"

const ALLOWED_NESTED_BLOCKS = ["core/image"]

const AsideWithImageEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<AsideWithImageBlockAttributes>>
> = ({ clientId, attributes: { title, content }, setAttributes }) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <div>
        <div
          className={css`
            padding: 1rem;
            background: ${baseTheme.colors.clear[100]};
            display: grid;
            grid-template-columns: 0.4fr 1fr;
            font-family: ${headingFont};

            figure {
              width: 180px;
              margin: 0 !important;
            }
          `}
        >
          <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
          <div>
            <RichText
              className={css`
                font-weight: 600;
              `}
              // eslint-disable-next-line i18next/no-literal-string
              tagName="h4"
              value={title}
              onChange={(value: string) => setAttributes({ title: value })}
              placeholder={t("heading-placeholder")}
            />
            <RichText
              className={css`
                text-align: center;
              `}
              // eslint-disable-next-line i18next/no-literal-string
              tagName="span"
              value={content}
              onChange={(value: string) => setAttributes({ content: value })}
              placeholder={t("copy-text-placeholder")}
            />
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}

export default AsideWithImageEditor
