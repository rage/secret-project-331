/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

interface StyledObjectiveProps {
  index: number
}

interface WrapperProps {
  length: number
}

const Wrapper = styled.div<WrapperProps>`
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 1.5rem;
  margin: 4em auto;
  max-width: 2000px;

  ${respondToOrLarger.md} {
    padding: 1rem 7rem;
  }

  h2 {
    z-index: 20;
    width: ${({ length }) => length > 6 && "800px"};
    font-size: clamp(30px, 3.5vw, 48px);
    font-style: normal;
    font-weight: 700;
    text-align: center;
    margin: 0 auto;
    color: ${baseTheme.colors.gray[700]};
    padding-bottom: 1em;
    line-height: 120%;
  }
`

const TextBox = styled.div`
  display: grid;
  width: 100%;
  grid-auto-flow: none;
  grid-template-columns: 1fr;
  grid-template-rows: repeat(auto-fill, auto);
  margin-bottom: 1rem;
  grid-row-gap: 0.5em;
  grid-column-gap: 1em;
  justify-content: center;

  ${respondToOrLarger.lg} {
    padding: 0rem 0rem;
    grid-template-columns: repeat(3, 1fr);
  }

  h3 {
    opacity: 0.8;
    text-align: left;
    padding-right: 0;

    ${respondToOrLarger.md} {
      padding-right: 40px;
    }
  }
`
const Objective = styled.div<StyledObjectiveProps>`
  width: 100%;
  height: 100%;
  background: #f7f8f9;
  position: relative;
  overflow: hidden;
  padding: 2rem;
  border: 2px solid #edf0f2;

  .paragraph {
    text-align: left;
    font-size: 18px;
  }

  .list {
    margin: 0.5rem 2rem;
    text-align: left;
    padding-right: 0;
    z-index: 99;
  }

  svg {
    position: absolute;
    top: -45px;
    left: -100px;
    transform: rotate(180deg);
  }
`
export interface CourseObjectiveSectionProps {
  title: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CourseObjectiveSectionProps

const CourseObjective: React.FC<React.PropsWithChildren<React.PropsWithChildren<CardProps>>> = ({
  title,
  children,
}) => {
  const data = children && Object.values(children)[0].props.data.innerBlocks
  const titleLength = title.split(" ").length
  return (
    <Wrapper length={titleLength}>
      <h2>{title}</h2>
      <TextBox>
        {data &&
          data.map((item: { innerBlocks: any; clientId: string | null }, index: number) => {
            const innerBlocks = item.innerBlocks
            const isList = innerBlocks[0].name === "core/list"
            let list

            if (isList && innerBlocks[0]) {
              const values = innerBlocks[0].attributes.values
              const parser = new DOMParser()
              // eslint-disable-next-line i18next/no-literal-string
              const listItem = parser.parseFromString(values, "text/html")
              list = [].slice.call(listItem.body.childNodes).map(({ innerHTML }) => innerHTML)
            }

            return isList ? (
              <Objective key={item.clientId} index={index}>
                {list?.map((childHtml) => (
                  <span className="list" key={childHtml}>
                    {childHtml}
                  </span>
                ))}
              </Objective>
            ) : (
              <Objective key={item.clientId} index={index}>
                {innerBlocks && innerBlocks[0].name === "core/heading" && (
                  <h3
                    className={css`
                      font-size: 18px !important;
                      z-index: 20;
                      line-height: 120%;
                      margin-bottom: 0.8rem;
                      font-style: normal;
                      font-weight: 600;
                      text-align: left;
                    `}
                  >
                    {innerBlocks[0].attributes.content}
                  </h3>
                )}
                <span className="paragraph">
                  {innerBlocks && innerBlocks.length > 1
                    ? innerBlocks[1].attributes.content
                    : innerBlocks[0].attributes.content}
                </span>
              </Objective>
            )
          })}
      </TextBox>
    </Wrapper>
  )
}

export default CourseObjective
