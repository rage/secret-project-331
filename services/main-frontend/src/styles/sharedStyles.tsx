import { css } from "@emotion/css"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const buttonBase = css`
  padding: 4px 8px;
  border-radius: 2px;
  border: none;
  font-family: "Inter", sans-serif;

  ${respondToOrLarger.lg} {
    padding: 8px 16px;
  }
`

export const primaryButton = css`
  ${buttonBase};
  background: #065853;
  color: white;
  white-space: nowrap;
`

export const disabledButton = css`
  ${buttonBase};
  background: #a9acb3;
  color: #666666;
  cursor: not-allowed;
`

export const containerBase = css`
  padding: 20px 0px;
  color: #1a2333;
  max-width: 100%;

  ${respondToOrLarger.lg} {
    padding: 40px;
    max-width: 80rem;
    margin: 0 auto;
  }
`

export const actionButtonStyle = css`
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 4px;

  &:hover {
    background: #f1f1f1;
  }
`
