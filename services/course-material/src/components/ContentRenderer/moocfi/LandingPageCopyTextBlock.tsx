import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { BlockRendererProps } from ".."
import { baseTheme, headingFont, primaryFont } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

const Wrapper = styled.div`
margin: .5rem 0;
border-top: 3px solid #313947;

h1 {
  font-weight: 800 !important;
  color: green !important;
  margin-top: 0;
}

h2 {
  border-top: 3px solid #313947;
  font-weight: 600 !important;
  color: ${baseTheme.colors.green[700]};
}


`

const LandingPageCopyTextBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (
  props,
) => {
  return (
      <Wrapper>
        <InnerBlocks parentBlockProps={props} />
      </Wrapper>
  )
}

export default withErrorBoundary(LandingPageCopyTextBlock)
