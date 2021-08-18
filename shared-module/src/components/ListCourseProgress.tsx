import styled from "@emotion/styled"
import React from "react"

import CircularProgressBar from "./CircularProgressBar"

const Wrapper = styled.aside`
  padding: 0 0 4em 0;
  margin-top: 3em;
  margin-bottom: 1em;
  border-radius: 10px;
  position: relative;
  width: 100%;

  h2 {
    text-align: center;
    color: #3b4754;
    font-family: "Josefin Sans", sans-serif;
    text-transform: uppercase;
    font-size: 1.6rem;
    margin-bottom: 2rem;
  }
`
const Link = styled.a`
  color: #1c3b40;
  box-shadow: none;
`

const ImageBox = styled.div`
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
  display: flex;
  align-items: center;

  ${({ selected }: ChapterBoxExtraProps) =>
    selected &&
    `
    background-color: #f1f1f1;
    font-weight: 600;

    :hover {
      background-color: #D8D8D8 !important;
    }
  `}
  :hover {
    background-color: #d8d8d8;
  }

  span {
    vertical-align: top;
    /* marginLeft: "1em", */
    font-size: 18px;
    display: inline-block;
    width: 80%;
    margin: 0.4em 0 0.4em 0.2em;
    font-family: "Josefin Sans", sans-serif;
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
const StyledCircularProgressBar = styled(CircularProgressBar)`
  position: absolute;
  right: 30px;
  top: 30%;
`

export interface ChapterBoxExtraProps {
  variant: "text" | "link" | "readOnly"
  selected: boolean
  chapterIndex: string
  chapterTitle: string
}

export type ChapterBoxProps = React.HTMLAttributes<HTMLDivElement> & ChapterBoxExtraProps

const ChapterBox: React.FC<ChapterBoxProps> = (props) => {
  return (
    <Wrapper>
      <>
        <Link href="/">
          <ChapterParts {...props}>
            <ImageBox>
              <div>
                <p>{props.chapterIndex}</p>
              </div>
            </ImageBox>
            <span>{props.chapterTitle}</span>
            <CircularProgressBar point={54} />
          </ChapterParts>
        </Link>
      </>
    </Wrapper>
  )
}

export default ChapterBox
