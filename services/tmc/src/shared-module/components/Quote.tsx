import styled from "@emotion/styled"
import React from "react"

import QuoteIMG from "../img/quote.svg"

const Justify = styled.div`
  display: grid;
  justify-content: center;
`

const StyledImg = styled.div`
  position: absolute;
  width: 40px;
  top: 40px;
  left: 46px;
  opacity: 0.15;
`

const ContentWrapper = styled.div`
  padding: 0.5rem 2rem;
  margin: 2.5rem 0;
  max-width: 650px;
  border-left: 7px solid #bfbfbf;
  background: rgba(0, 0, 0, 0.02);
  position: relative;
`

const Text = styled.div`
  font-size: 1.1rem;
  font-weight: 500;
  line-height: 1.5;
  text-align: left;
`

export interface QuoteExtraProps {
  variant: "pullquote" | "blockquote"
  content: string
}

export type QuoteProps = React.QuoteHTMLAttributes<HTMLQuoteElement> & QuoteExtraProps

const Quote: React.FC<QuoteProps> = ({ content }) => {
  return (
    <Justify>
      <ContentWrapper>
        <StyledImg>
          <QuoteIMG width="30px" height="20px" role="presentation" alt="" />
        </StyledImg>
        <Text> {content} </Text>
      </ContentWrapper>
    </Justify>
  )
}

export default Quote
