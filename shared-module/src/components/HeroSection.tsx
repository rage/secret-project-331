import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

/* import { border, color, space } from "styled-system" */
import { theme, typography } from "../utils"

const HeroWrapper = styled.div`
  background: #cacaca;
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`

const TextBox = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  h1 {
    font-size: 50px;
    font-size: ${typography.h2};
    font-weight: 400;
    z-index: 20;
    margin-bottom: 0.8rem;
    margin-top: 1.5rem;
    line-height: 1.1;
  }

  span {
    color: #202020;
    font-size: ${typography.h4};
    opacity: 0.8;
    z-index: 20;
  }
`
export interface HeroSectionProps {
  subtitle: string
  title: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & HeroSectionProps

const HeroSection: React.FC<CardProps> = ({ title, subtitle }) => {
  return (
    <ThemeProvider theme={theme}>
      <>
        <HeroWrapper>
          <TextBox>
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </TextBox>
        </HeroWrapper>
      </>
    </ThemeProvider>
  )
}

export default HeroSection
