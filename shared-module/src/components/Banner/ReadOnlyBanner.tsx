import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../../styles"

// eslint-disable-next-line i18next/no-literal-string
const BannerWrapper = styled.div`
  background: ${baseTheme.colors.clear[100]};
  width: 100%;
  position: relative;
  padding: 3rem 2rem;
  margin: 0 auto;
  display: block;
`

const Content = styled.div`
  font-weight: 500;
  font-size: 1.2rem;
  line-height: 1.4;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
`
const Text = styled.div`
  text-align: center;

  div {
    color: #3b4754;
  }
`

export interface BannerExtraProps {
  variant: "text" | "link" | "read-only"
  content: string
}

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & BannerExtraProps

const Quote: React.FC<BannerProps> = (props) => {
  return (
    <BannerWrapper {...props}>
      <Content>
        <Text>
          <div>{props.children}</div>
        </Text>
      </Content>
    </BannerWrapper>
  )
}

export default Quote
