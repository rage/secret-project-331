/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { respondToOrLarger } from "../../styles/respond"

interface StyledObjectiveProps {
  index: number
}

const Wrapper = styled.div`
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 3rem;

  h2 {
    z-index: 20;
    font-size: 3.5rem;
    font-size: clamp(30px, 3vw, 3rem);
    font-style: normal;
    font-weight: 600;
    text-align: left;
    padding-bottom: 1em;
    line-height: 1.1;
  }
`

const TextBox = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  gap: 1rem;
  justify-content: center;

  ${respondToOrLarger.md} {
    padding: 0rem 0rem;
    grid-template-columns: repeat(2, 1fr);
  }

  ${respondToOrLarger.lg} {
    padding: 0rem 0rem;
    grid-template-columns: repeat(3, 1fr);
  }

  h3 {
    text-align: left;
    padding-right: 0;

    ${respondToOrLarger.md} {
      padding-right: 40px;
    }
  }
`
const Objective = styled.div<StyledObjectiveProps>`
  width: 100%;
  min-height: 100%;
  background: ${({ index }) => index === 1 && `#1a2333`};
  position: relative;
  overflow: hidden;
  display: grid;
  border: ${({ index }) => (index === 1 ? `none` : `1px solid #babdc2 `)};
  border-radius: 8px;
  color: ${({ index }) => index === 1 && `#dae3eb`};

  .paragraph {
    margin: auto 2rem 2rem 2rem;
    text-align: left;
    padding-right: 0;
    z-index: 99;
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
  return (
    <Wrapper>
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
                  <h2
                    className={css`
                      font-size: 20px !important;
                      margin: 2rem 2rem 0 2rem;
                    `}
                  >
                    {innerBlocks[0].attributes.content}
                  </h2>
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
