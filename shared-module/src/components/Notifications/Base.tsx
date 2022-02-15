import styled from "@emotion/styled"

import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

export const NotificationWrapper = styled.div`
  width: 150px;
  background: ${baseTheme.colors.clear[200]};
  height: 100px;
  ${respondToOrLarger.xs} {
    width: 400px;
    min-height: 100px;
  }
`
