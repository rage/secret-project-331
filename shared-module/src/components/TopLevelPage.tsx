import styled from "@emotion/styled"
import React from "react"

import { headingFont } from "../styles"

// eslint-disable-next-line i18next/no-literal-string
const Content = styled.div`
  margin: 0 auto;
  max-width: 900px;
  background: #ecf3f2;
  display: flex;
  height: auto;
  align-items: center;
  justify-content: space-between;
  padding: 2.4rem 2rem;
  color: #1a2333;

  h3 {
    font-family: ${headingFont};
    font-size: clamp(28px, 3vw, 30px);
    color: #065853;
  }

  span {
    font-family: ${headingFont};
    font-size: 18px;
    opacity: 0.8;
  }
`

const Wrapper = styled.div`
  h2 {
    text-align: center;
    font-weight: 600;
    margin-bottom: 2rem;
  }
`

export interface TopLevelPageExtraProps {
  page: any
}

export type TopLevelPage = React.HTMLAttributes<HTMLDivElement> & TopLevelPageExtraProps

const placeholder = "FAQ"
// eslint-disable-next-line i18next/no-literal-string
const subtitlePlaceholder = "Find answers to frequently asked questions on the FAQ page"
// eslint-disable-next-line i18next/no-literal-string
const titlePlaceholder = "Top level pages"

const TopLevelPage: React.FC<TopLevelPage> = ({ page }) => {
  return (
    <Wrapper>
      <h2>{titlePlaceholder}</h2>
      <Content>
        <div>
          <h3>{placeholder}</h3>
          <span>{subtitlePlaceholder}</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="57" height="40" viewBox="0 0 56.957 49">
          <path
            id="Path_2435"
            d="M32.466,0,29.321,3.146l19.123,19.11H0v4.475H48.444L29.321,45.854,32.466,49l24.49-24.506Z"
            fill="#44827E"
          />
        </svg>
      </Content>
    </Wrapper>
  )
}

export default TopLevelPage
