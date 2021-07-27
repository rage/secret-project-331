import styled from "@emotion/styled"
import React from "react"

import quoteImg from "../img/quote.png"

const Justify = styled.div`
  display: grid;
  justify-content: center;
`

const ContentWrapper = styled.div`
  padding: 4rem 2rem 4rem;
  background: rgba(0, 0, 0, 0.02);
  margin: 4rem 0;
  max-width: 780px;
  border-left: 8px solid #333333;
`

const Text = styled.div`
  font-weight: 500;
  text-align: left;
  font-size: 1.2rem;
  line-height: 1.6;
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
        <img src={quoteImg} alt="Nothing" width="30px" />
        <Text> {content} </Text>
      </ContentWrapper>
    </Justify>
  )
}

export default Quote
