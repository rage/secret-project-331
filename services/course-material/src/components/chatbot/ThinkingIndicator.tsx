// Modified from https://github.com/vineethtrv/css-loader, MIT
import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"

import { baseTheme } from "@/shared-module/common/styles"

const bounce = keyframes`
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-3px);
  }
`

// eslint-disable-next-line i18next/no-literal-string
const Dot = styled.span<{ delaySeconds: number }>`
  display: inline-block;
  width: 3px;
  height: 3px;
  margin: 0 2px;
  background-color: ${baseTheme.colors.gray[400]};
  border-radius: 50%;

  animation-name: ${bounce};
  animation-duration: 1.3s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-delay: ${({ delaySeconds }) => delaySeconds}s;
`

const ThinkingIndicator = () => {
  return (
    <span
      className={css`
        margin: 0 3px;
      `}
    >
      <Dot delaySeconds={0} />
      <Dot delaySeconds={0.2} />
      <Dot delaySeconds={0.4} />
    </span>
  )
}

export default ThinkingIndicator
