import styled from "@emotion/styled"
import React from "react"

import ArrowSVGIcon from "../img/arrow.svg"

const Wrapper = styled.aside`
  border-radius: 10px;
  position: relative;
  width: 100%;

  h2 {
    text-align: center;
    color: #3b4754;
    text-transform: uppercase;
    font-size: 1.6rem;
    margin-bottom: 2rem;
  }
`
const Link = styled.a`
  color: #1c3b40;
  box-shadow: none;
`

const PageNumberBox = styled.div`
  @media (min-width: 1px) {
    width: 40px;
    height: 40px;
    position: relative;
    vertical-align: middle;
    display: inline-block;
  }

  div {
    width: 100%;
    height: 100%;
    z-index: 2;
    text-align: center;
    display: flex;
    align-content: center;
    padding-top: 7px;
  }

  p {
    width: 100%;
    height: 100%;
    text-align: center;
    z-index: 3;
    color: #333;
    font-size: 16px;
    margin-bottom: 0;
  }
`
/* const StyledArrow = styled(Arrow)`
  display: absolute;
  right: 0;
` */

const ChapterParts = styled.div`
  position: relative;
  margin-left: 0em;
  padding: 0.6em 1em;
  list-style-type: none;
  color: #333;
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

  img {
    position: absolute;
    right: 30px;
    top: 30%;
  }

  span {
    vertical-align: top;
    /* marginLeft: "1em", */
    font-size: 18px;
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
  url?: string
}

export type PagesInChapterBoxProps = React.HTMLAttributes<HTMLDivElement> &
  PagesInChapterBoxExtraProps

const PagesInChapterBox: React.FC<PagesInChapterBoxProps> = (props) => {
  return (
    <Wrapper>
      <>
        <Link href={`${props.url}`}>
          <ChapterParts {...props}>
            <PageNumberBox>
              <div>
                <p>{props.chapterIndex}</p>
              </div>
            </PageNumberBox>
            <span>{props.chapterTitle}</span>
            <ArrowSVGIcon alt="next icon" width="20" />
          </ChapterParts>
        </Link>
      </>
    </Wrapper>
  )
}

export default PagesInChapterBox
