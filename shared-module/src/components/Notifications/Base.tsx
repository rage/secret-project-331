import styled from "@emotion/styled"

import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

export const NotificationWrapper = styled.div`
  width: 150px;
  background: ${baseTheme.colors.clear[200]};
  height: 50px;

  ${respondToOrLarger.xs} {
    width: 400px;
    height: unset;
    min-height: 100px;
    max-height: 200px;
  }
`
