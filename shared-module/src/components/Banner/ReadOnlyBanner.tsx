import styled from "@emotion/styled"
import React from "react"

const BannerWrapper = styled.div`
  background: rgba(212, 212, 217, 1);
  width: 100%;
  max-width: 1984px;
  position: relative;
  padding: 0 2rem;
  margin: 0 auto;
  display: block;
`

const Content = styled.div`
  padding: 2rem 15rem 2.5rem 15rem;
  max-width: 1760px;
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.4;
  font-family: "Lato", sans-serif;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;

  a {
    text-decoration: none;
    max-width: 100%;
    cursor: pointer;
    display: flex;
    height: 1rem;
    line-height: 1rem;
    margin-top: 1rem;

    span {
      display: flex;
      align-items: center;
      margin-left: 0.5rem;
    }
  }
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
