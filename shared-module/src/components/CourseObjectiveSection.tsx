import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../styles"
import { respondToOrLarger } from "../styles/respond"

// eslint-disable-next-line i18next/no-literal-string
const HeroWrapper = styled.div`
  background: ${baseTheme.colors.clear[200]};
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 3rem 1rem;
`

const TextBox = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  ${respondToOrLarger.xs} {
    padding: 2rem 3rem;
  }

  ${respondToOrLarger.sm} {
    padding: 2rem 4rem;
  }

  ${respondToOrLarger.md} {
    padding: 2rem grem;
  }
  ${respondToOrLarger.lg} {
    padding: 2rem 6rem;
  }

  h2 {
    z-index: 20;
    font-size: clamp(30px, 3vw, 3rem);
    font-style: normal;
    font-weight: 600;
    text-align: center;
    padding-bottom: 1em;
    line-height: 1.1;
  }

  h3 {
    text-align: left;
    padding-right: 0;

    ${respondToOrLarger.md} {
      padding-right: 40px;
    }
  }

  p {
    text-align: left;
    padding-right: 0;

    ${respondToOrLarger.md} {
      padding-right: 40px;
    }
  }

  span {
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    line-height: 40px;
    /* or 182% */

    text-align: center;

    color: ${baseTheme.colors.clear[200]};

    opacity: 0.7;
  }
`
export interface CourseObjectiveSectionProps {
  title: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CourseObjectiveSectionProps

const CourseObjectiveSection: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<CardProps>>
> = ({ title, children }) => {
  return (
    <>
      <>
        <HeroWrapper>
          <TextBox>
            <h2>{title}</h2>
            {children}
          </TextBox>
        </HeroWrapper>
      </>
    </>
  )
}

export default CourseObjectiveSection
