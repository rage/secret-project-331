import styled from "@emotion/styled"
import React from "react"

const Justify = styled.div`
  display: grid;
  justify-content: center;
`

const ContentWrapper = styled.div`
  padding: 4rem 2rem 4rem;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 12px 0px;
  margin: 4rem 0;
  max-width: 780px;
  border-left: 8px solid #bfbfbf;
`

const Text = styled.div`
  font-weight: 500;
  text-align: left;
  font-size: 1.2rem;
  line-height: 1.6;
  font-style: italic;
`

export interface CardExtraProps {
  variant: "pullquote" | "blockquote"
  content: string
}

export type QuoteProps = React.QuoteHTMLAttributes<HTMLQuoteElement> & CardExtraProps

const Quote: React.FC<QuoteProps> = ({ content }) => {
  return (
    <Justify>
      <ContentWrapper>
        <Text> {content} </Text>
      </ContentWrapper>
    </Justify>
  )
}

export default Quote
