import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React from "react"

import Bulleye from "../img/bulleye.svg"
import Cross from "../img/cross.svg"
import { headingFont } from "../styles"

interface SVGProps {
  isEven: boolean
}
// eslint-disable-next-line i18next/no-literal-string
const BulleyeTopPosition = "-40px"
// eslint-disable-next-line i18next/no-literal-string
const CrossTopPosition = "-20px"

// eslint-disable-next-line i18next/no-literal-string
const Content = styled.div`
  margin: 0 auto;
  max-width: 100%;
  background: #ecf3f2;
  display: flex;
  height: auto;
  align-items: center;
  justify-content: space-between;
  padding: 2rem;
  color: #1a2333;
  margin-bottom: 10px;
  overflow: hidden;
  position: relative;
  cursor: pointer;

  transition: filter 0.2s;
  filter: brightness(100%) contrast(100%);
  &:hover {
    filter: brightness(92%) contrast(110%);
  }

  h3 {
    font-family: ${headingFont};
    font-size: clamp(24px, 2.8vw, 28px);
    font-weight: 600;
    color: #065853;
  }

  span {
    font-family: ${headingFont};
    font-size: 18px;
    opacity: 0.8;
  }
`
// eslint-disable-next-line i18next/no-literal-string
const SVGWrapper = styled.div<SVGProps>`
  position: absolute;
  width: 90px;
  height: 90px;
  top: ${({ isEven }) => (isEven ? BulleyeTopPosition : CrossTopPosition)};
  left: 20px;
`

export interface TopLevelPageExtraProps {
  title: string
  url: string
  index: number
}

export type TopLevelPage = React.HTMLAttributes<HTMLDivElement> & TopLevelPageExtraProps

// eslint-disable-next-line i18next/no-literal-string
/* const subtitlePlaceholder = "Find answers to frequently asked questions on the FAQ page" */

const TopLevelPage: React.FC<React.PropsWithChildren<React.PropsWithChildren<TopLevelPage>>> = ({
  title,
  url,
  index,
}) => {
  const isEven = index % 2 === 0
  return (
    <Link href={url} passHref>
      <a
        className={css`
          text-decoration: none;
        `}
        href="replace"
      >
        <Content>
          <div>
            <SVGWrapper isEven={isEven}>{isEven ? <Bulleye /> : <Cross />}</SVGWrapper>
            <h3>{title}</h3>
            {/* <span>{subtitlePlaceholder}</span> */}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 56.957 49">
            <path
              d="M32.466,0,29.321,3.146l19.123,19.11H0v4.475H48.444L29.321,45.854,32.466,49l24.49-24.506Z"
              fill="#44827E"
            />
          </svg>
        </Content>
      </a>
    </Link>
  )
}

export default TopLevelPage
