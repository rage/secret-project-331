import styled from "@emotion/styled"

import { baseTheme } from "@/shared-module/common/styles"

export const StyledUl = styled.ul`
  margin: 1rem 0;
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-radius: 8px;
`
export const StyledLi = styled.li`
  margin: 0.5rem 0;
  padding: 1.5rem;
  background-color: ${baseTheme.colors.primary[100]};
  border: 1px solid ${baseTheme.colors.clear[300]};
  border-radius: 6px;
`
