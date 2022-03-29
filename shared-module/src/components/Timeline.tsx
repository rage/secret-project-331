/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../styles"

export interface TimelineExtraProps {
  variant: "large" | "medium" | "small"
  disableMargin?: boolean
}

export type TimelineProps = React.HTMLAttributes<HTMLDivElement> & TimelineExtraProps

const Wrapper = styled.div/* <SpinnerProps> */ ``

const Timeline: React.FC<TimelineProps> = (props) => {
  return <Wrapper {...props}></Wrapper>
}

export default Timeline
