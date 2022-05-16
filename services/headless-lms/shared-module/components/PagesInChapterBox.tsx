import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React from "react"

import ArrowSVGIcon from "../img/blackArrow.svg"
import { baseTheme, headingFont } from "../styles"

const Wrapper = styled.div`
  border-radius: 10px;
  position: relative;
  width: 100%;
`

const PageNumberBox = styled.div`
  position: relative;
  display: inline-block;
  font-family: ${headingFont};
  margin: 0 1rem;
`
const StyledArrow = styled(ArrowSVGIcon)`
  opacity: 0.6;
`

const ChapterParts = styled.div`
  position: relative;
  margin-left: 0em;
  padding: 0.6em 1em;
  list-style-type: none;
  color: ${baseTheme.colors.grey[700]};
  text-decoration: none;
  border-radius: 2px;
  margin-bottom: 0.4em;
  background: #f1f1f1;

  ${({ selected }: PagesInChapterBoxExtraProps) =>
    selected &&
    `
    background-color: #D8D8D8;
    font-weight: 600;

    :hover {
      background-color: #D8D8D8 !important;
    }
  `}
  :hover {
    background-color: #d8d8d8;
  }

  svg {
    position: absolute;
    right: 30px;
    top: 30%;
  }

  span {
    vertical-align: top;
    font-size: clamp(16px, 1vw, 18px);
    display: inline-block;
    width: 80%;
    margin: 0.4em 0 0.4em 0.2em;
    text-transform: uppercase;
  }
`
/*
const chooseChapterValue = {
  0: "I",
  1: "II",
  2: "III",
  3: "IV",
  4: "V",
} */

export interface PagesInChapterBoxExtraProps {
  variant: "text" | "link" | "readOnly"
  selected: boolean
  chapterIndex: number
  chapterTitle: string
  url: string
}

export type PagesInChapterBoxProps = React.HTMLAttributes<HTMLDivElement> &
  PagesInChapterBoxExtraProps

const PagesInChapterBox: React.FC<PagesInChapterBoxProps> = (props) => {
  return (
    <Wrapper>
      <>
        <Link href={props.url} passHref>
          <a
            href="replace"
            className={css`
              color: #1c3b40;
              box-shadow: none;
              &:focus-visible {
                outline: 2px solid ${baseTheme.colors.green[500]};
                outline-offset: 2px;
              }
            `}
          >
            <ChapterParts {...props}>
              <PageNumberBox>
                <span>{props.chapterIndex}</span>
              </PageNumberBox>
              <span>{props.chapterTitle}</span>
              <StyledArrow role="presentation" alt="" width="20" />
            </ChapterParts>
          </a>
        </Link>
      </>
    </Wrapper>
  )
}

export default PagesInChapterBox
