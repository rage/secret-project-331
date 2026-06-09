"use client"

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

import { baseTheme } from "@/styles/theme"

const rotation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

const Spinner = styled.div`
  margin: 1rem;
  width: 30px;
  height: 30px;
  border: 5px solid ${baseTheme.colors.blue[300]};
  border-bottom-color: ${baseTheme.colors.green[500]};
  border-radius: 50%;
  display: inline-block;
  animation: ${rotation} 1s linear infinite;
`

export default Spinner
