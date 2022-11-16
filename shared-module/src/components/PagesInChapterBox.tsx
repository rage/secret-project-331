import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import React from "react"

import ArrowSVGIcon from "../img/blackArrow.svg"
import { baseTheme, headingFont, secondaryFont } from "../styles"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  border-radius: 10px;
  position: relative;
  width: 100%;

  .chapter-part-arrow {
    visibility: hidden;
  }
`

const PageNumberBox = styled.div`
  position: relative;
  display: inline-block;
  font-family: ${secondaryFont};
  opacity: 0.6;
  margin: 0 0.8rem 0 0.4rem;
  top: -3px;
`

// eslint-disable-next-line i18next/no-literal-string
const ChapterParts = styled.div`
  position: relative;
  margin-left: 0em;
  padding: 0.8em 1em;
  list-style-type: none;
  color: rgb(17, 24, 36);
  text-decoration: none;
  border-radius: 2px;
  margin-bottom: 0.4em;
  background: rgb(242, 245, 247);

  ${({ selected }: PagesInChapterBoxExtraProps) =>
    selected &&
    `
    background-color: #D8D8D8;
    font-weight: 500;

    .chapter-part-arrow {
      visibility: visible;
    }

    :hover {
      background-color: rgb(235, 239, 242) !important;
    }
  `}
  :hover {
    background-color: rgb(235, 239, 242);
  }

  svg {
    position: absolute;
    right: 30px;
    top: 37%;
  }

  span {
    font-family: ${headingFont};
    font-weight: 500;
    vertical-align: top;
    font-size: clamp(16px, 1.2vw, 20px);
    display: inline-block;
    width: 80%;
    margin: 0.4em 0 0.4em 0.2em;
  }
`

export interface PagesInChapterBoxExtraProps {
  variant: "text" | "link" | "readOnly"
  selected: boolean
  chapterIndex: number
  chapterTitle: string
  url: string
}

export type PagesInChapterBoxProps = React.HTMLAttributes<HTMLDivElement> &
  PagesInChapterBoxExtraProps

const PagesInChapterBox: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<PagesInChapterBoxProps>>
> = (props) => {
  return (
    <Wrapper>
      <>
        <Link href={props.url} passHref>
          <a
            className={css`
              color: #1c3b40;
              box-shadow: none;
              &:focus-visible {
                outline: 2px solid ${baseTheme.colors.green[500]};
                outline-offset: 2px;
              }

              :hover {
                .chapter-part-arrow {
                  visibility: visible;
                }
              }
            `}
          >
            <ChapterParts {...props}>
              <PageNumberBox>
                <span>{props.chapterIndex}</span>
              </PageNumberBox>
              <span>{props.chapterTitle}</span>
              <ArrowSVGIcon className="chapter-part-arrow" role="presentation" alt="" width="20" />
            </ChapterParts>
          </a>
        </Link>
      </>
    </Wrapper>
  )
}

export default PagesInChapterBox
