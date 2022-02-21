import styled from "@emotion/styled"

import { baseTheme } from "../styles"

// eslint-disable-next-line i18next/no-literal-string
const SkipLink = styled.a`
  background: ${baseTheme.colors.green[600]};
  color: ${baseTheme.colors.clear[100]};
  font-weight: 700;
  left: 50%;
  padding: 6px;
  position: absolute;
  transform: translateY(-100%);
  text-decoration: none;
  z-index: 100000;

  &:focus {
    transform: translateY(0%);
  }
`

export default SkipLink
