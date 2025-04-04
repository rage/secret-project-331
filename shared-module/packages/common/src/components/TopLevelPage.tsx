import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React from "react"

import { primaryFont } from "../styles"
import { respondToOrLarger } from "../styles/respond"

const Content = styled.div`
  margin: 0 auto;
  max-width: 100%;
  background: rgb(242, 245, 247);
  display: flex;
  height: auto;
  align-items: center;
  justify-content: space-between;
  padding: 1.6rem;
  color: #1a2333;
  margin-bottom: 10px;
  overflow: hidden;
  position: relative;
  cursor: pointer;

  transition: filter 0.2s;
  filter: brightness(100%) contrast(100%);
  &:hover {
    background-color: rgb(235, 239, 242);
  }

  h3 {
    font-family: ${primaryFont};
    font-size: 22px;
    font-weight: 400;
    color: #1a2333;
  }

  span {
    font-family: ${primaryFont};
    font-size: 18px;
    opacity: 0.8;
  }

  .right-arrow {
    height: 15px;
    width: 15px;
    ${respondToOrLarger.md} {
      height: 22px;
      width: 22px;
    }
  }
`

export interface TopLevelPageExtraProps {
  title: string
  url: string
  index: number
}

export type TopLevelPageProps = React.HTMLAttributes<HTMLDivElement> & TopLevelPageExtraProps

/* const subtitlePlaceholder = "Find answers to frequently asked questions on the FAQ page" */

const TopLevelPage: React.FC<React.PropsWithChildren<TopLevelPageProps>> = ({ title, url }) => {
  return (
    <Link
      href={url}
      className={css`
        text-decoration: none;
      `}
    >
      <Content>
        <div>
          <h3>{title}</h3>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56.957 49" className="right-arrow">
          <path
            d="M32.466,0,29.321,3.146l19.123,19.11H0v4.475H48.444L29.321,45.854,32.466,49l24.49-24.506Z"
            fill="#1a2333"
          />
        </svg>
      </Content>
    </Link>
  )
}

export default TopLevelPage
