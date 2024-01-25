import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import BreakFromCentered from "../../shared-module/common/components/Centering/BreakFromCentered"

export const FullWidthTableRow = styled.tr`
  background: #ffffff;
  td {
    padding-top: 24px;
    padding-bottom: 24px;
    border-top: 1px solid rgba(190, 190, 190, 0.6);
    border-bottom: 1px solid rgba(190, 190, 190, 0.6);
    font-size: 16px;
    line-height: 20px;
  }
  & :first-child {
    padding-left: 24px;
    border-left: 1px solid rgba(190, 190, 190, 0.6);
  }
  & :last-child {
    padding-right: 24px;
    border-right: 1px solid rgba(190, 190, 190, 0.6);
  }
`

const FullWidthTable: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          overflow: auto;
        `}
      >
        <table
          className={css`
            margin: 0 auto;
            width: max-content;
            margin-top: 67px;
            border-spacing: 0 10px;
            padding: 0 1rem;
            th:not(:first-child),
            td {
              padding-left: 30px;
            }
          `}
        >
          {children}
        </table>
      </div>
    </BreakFromCentered>
  )
}

export default FullWidthTable
