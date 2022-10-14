import styled from "@emotion/styled"
import React from "react"

import { BlockRendererProps } from ".."
import { baseTheme } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  margin: 0.5rem 0;
  padding-bottom: 20px;
  position: relative;

  h2 {
    font-weight: 700 !important;
    color: ${baseTheme.colors.green[600]} !important;
    padding: 1.5rem 1.5rem 0 2rem;
  }

  p {
    padding: 0 2rem 0 2rem;
    font-weight: 400 !important;
  }

  .line {
    position: absolute;
  }

  .top {
    width: 100%;
    height: 2px;
    top: 10px;
    background: #cecfd3;
  }

  .bottom {
    width: 100%;
    height: 2px;
    bottom: 10px;
    background: #cecfd3;
  }

  .left {
    height: 100%;
    width: 2px;
    left: 10px;
    background: #cecfd3;
  }

  .right {
    height: 100%;
    width: 2px;
    right: 10px;
    background: #cecfd3;
  }

  li {
    margin-left: 1.5rem;
  }

  h3 {
    font-weight: 700 !important;
    padding: 1.5rem 1.5rem 0 2rem;
    color: ${baseTheme.colors.green[700]};
  }
`

const LandingPageCopyTextBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (
  props,
) => {
  return (
    <Wrapper>
      <div className="line top"></div>
      <div className="line bottom"></div>
      <div className="line right"></div>
      <div className="line left"></div>
      <InnerBlocks parentBlockProps={props} />
    </Wrapper>
  )
}

export default withErrorBoundary(LandingPageCopyTextBlock)
