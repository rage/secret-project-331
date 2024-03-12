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

// eslint-disable-next-line i18next/no-literal-string
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
    margin-bottom: 1.4rem;
  }

  /*Overwrite InnerBlock Component styles*/

  figure {
    margin: 0;
    img {
      margin: 0;
      width: 250px;
      height: 223px;
      object-fit: cover;
      overflow-clip-margin: unset;
    }
  }

  div {
    margin-left: 0;
  }

  div.course-material-block > div > div:nth-child(2) {
    margin-bottom: 1.4rem !important;
  }

  div.course-material-block > div > div > div > div:nth-child(1) {
    max-width: 250px !important;
  }

  p {
    margin: 0;
    font-size: 1.125rem;
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
