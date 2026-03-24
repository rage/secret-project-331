import { css } from "@emotion/css"

import { secondaryFont } from "@/shared-module/common/styles"

export const exerciseCardPillShell = css`
  font-size: 9px;
  text-align: center;
  font-family: ${secondaryFont} !important;
  text-transform: uppercase;
  border-radius: 10px;
  background: #f0f0f0;
  height: 60px;
  padding: 8px 16px 6px 16px;
  color: #57606f;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  box-shadow:
    rgba(45, 35, 66, 0) 0 2px 4px,
    rgba(45, 35, 66, 0) 0 7px 13px -3px,
    #c4c4c4 0 -3px 0 inset;
`
