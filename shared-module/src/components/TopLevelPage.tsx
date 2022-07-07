import styled from "@emotion/styled"
import Link from "next/link"
import React from "react"

import { headingFont } from "../styles"

// eslint-disable-next-line i18next/no-literal-string
const Content = styled.div`
  margin: 0 auto;
  max-width: 100%;
  background: #ecf3f2;
  display: flex;
  height: auto;
  align-items: center;
  justify-content: space-between;
  padding: 2.4rem 2rem;
  color: #1a2333;
  margin-bottom: 10px;

  h3 {
    font-family: ${headingFont};
    font-size: clamp(24px, 2.8vw, 28px);
    color: #065853;
  }

  span {
    font-family: ${headingFont};
    font-size: 18px;
    opacity: 0.8;
  }
`

export interface TopLevelPageExtraProps {
  title: string
  url: string
}

export type TopLevelPage = React.HTMLAttributes<HTMLDivElement> & TopLevelPageExtraProps

// eslint-disable-next-line i18next/no-literal-string
/* const subtitlePlaceholder = "Find answers to frequently asked questions on the FAQ page" */

const TopLevelPage: React.FC<TopLevelPage> = ({ title, url }) => {
  return (
    <Link href={url} passHref>
      <Content>
        <div>
          <h3>{title}</h3>
          {/* <span>{subtitlePlaceholder}</span> */}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="57" height="40" viewBox="0 0 56.957 49">
          <path
            id="Path_2435"
            d="M32.466,0,29.321,3.146l19.123,19.11H0v4.475H48.444L29.321,45.854,32.466,49l24.49-24.506Z"
            fill="#44827E"
          />
        </svg>
      </Content>
    </Link>
  )
}

export default TopLevelPage
