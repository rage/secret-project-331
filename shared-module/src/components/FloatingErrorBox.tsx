import styled from "@emotion/styled"
import React from "react"

import Tick from "../img/tick.svg"
import { headingFont } from "../styles"

import Button from "./Button"

const ErrorWrapper = styled.div`
  max-width: 460px;
  height: 163px;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: #f5f5f5;
  display: grid;
  justify-content: center;
  align-items: center;
  position: relative;
`
const ButtonWrapper = styled.div`
  display: flex;
  gap: 26px;
`
const Message = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 30px;
  background: #e2efec;
  display: flex;
  justify-content: center;
  gap: 5px;

  span {
    display: inline-block;
    font-family: ${headingFont};
    color: #37bc9b;
    align-self: center;
  }
`

export interface ErrorExtraProps {
  variant: "success" | "error"
  content: string
}

export type ErrorProps = React.HTMLAttributes<HTMLDivElement> & ErrorExtraProps

const PLACEHOLDER_TEXT_ONE = "Reset"
const PLACEHOLDER_TEXT_TWO = "Your edit has been saved!"

const FloatingErrorBox: React.FC<ErrorProps> = () => {
  // If URL defined, the chapter is open

  return (
    <ErrorWrapper>
      <ButtonWrapper>
        <Button transform="capitalize" variant="primary" size="large">
          {PLACEHOLDER_TEXT_ONE}
        </Button>
        <Button transform="capitalize" variant="secondary" size="large">
          {PLACEHOLDER_TEXT_ONE}
        </Button>
      </ButtonWrapper>

      <Message>
        <Tick />
        <span>{PLACEHOLDER_TEXT_TWO}</span>
      </Message>
    </ErrorWrapper>
  )
}

export default FloatingErrorBox
