"use client"

import styled from "@emotion/styled"

import { baseTheme } from "@/shared-module/common/styles"

export { DEFAULT_CHART_HEIGHT } from "./constants"

export const InstructionBox = styled.div`
  background-color: ${baseTheme.colors.clear[100]};
  border-left: 4px solid ${baseTheme.colors.blue[600]};
  padding: 1rem;
  margin-bottom: 2rem;
  border-radius: 4px;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.9rem;
  line-height: 1.5;
`
