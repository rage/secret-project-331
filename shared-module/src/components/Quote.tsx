import styled from "@emotion/styled"
import Image from "next/image"
import React from "react"

import QuoteIMG from "../img/quote.png"

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
  padding: 5rem 3rem 4rem 3rem;
  background: rgba(0, 0, 0, 0.02);
  margin: 4rem 0;
  max-width: 780px;
  border-left: 8px solid #333333;
  position: relative;
`

const Text = styled.div`
  font-weight: 500;
  text-align: left;
  font-size: 1.1rem;
  line-height: 1.5;
  font-family: "Lato", sans-serif;
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
          <Image src={QuoteIMG} alt="quote icon" />
        </StyledImg>
        <Text> {content} </Text>
      </ContentWrapper>
    </Justify>
  )
}

export default Quote
