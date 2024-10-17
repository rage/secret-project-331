import { css } from "@emotion/css"
import { t } from "i18next"
import React from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import { fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface RevealableContentProps {
  backgroundColor: string
  separatorColor: string
}

const RevealableHiddenContentBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<RevealableContentProps>>
> = (props) => {
  return (
    <div
      className={css`
        padding-left: 14px;
        padding-right: 14px;
        padding-top: 14px;
        border-radius: 4px;
        background: #ffffff80;
        border: 2px dashed #718dbfcc;
        margin: -1rem 0;
        p,
        h4,
        li {
          font-size: 18px !important;
        }
      `}
    >
      <h4
        className={css`
          font-weight: ${fontWeights.semibold};
        `}
      >
        {t("an-insight-to-consider")}
      </h4>
      <InnerBlocks parentBlockProps={props} />
    </div>
  )
}

export default withErrorBoundary(RevealableHiddenContentBlock)
