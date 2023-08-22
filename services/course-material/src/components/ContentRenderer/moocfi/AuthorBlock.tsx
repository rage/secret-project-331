import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { t } from "i18next"
import React from "react"

import { BlockRendererProps } from ".."
import { baseTheme } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

interface InfoBoxBlockAttributes {
  backgroundColor: string
}

const Wrapper = styled.div`
  background: #f7f8f9;
  padding: 2rem 2rem 1rem 2rem;
  margin-bottom: 1rem;

  h3 {
    color: ${baseTheme.colors.gray[700]};
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #edf0f2;
    font-weight: 600;
    font-size: 22px;
    margin-bottom: 1.5rem;
  }

  /*Overwrite InnerBlock styles*/

  figure {
    margin: 0;
    img {
      margin: 0;
      width: 250px;
      height: 223px;
    }
  }

  div {
    margin-left: 0;
  }

  div .css-159pl2 :first-of-type {
    max-width: 250px !important;
  }

  p {
    margin: 0;
    font-size: 18px;
    font-weight: 400;
    color: ${baseTheme.colors.gray[600]};
  }
`

const AuthorBlock: React.FC<React.PropsWithChildren<BlockRendererProps<InfoBoxBlockAttributes>>> = (
  props,
) => {
  return (
    <Wrapper>
      <h3>{t("author")}</h3>
      <div>
        <InnerBlocks parentBlockProps={props} />
      </div>
    </Wrapper>
  )
}

export default withErrorBoundary(AuthorBlock)
