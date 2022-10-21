import { css } from "@emotion/css"
import React from "react"

import { Term } from "../../../../../shared-module/bindings"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"

interface TooltipProps {
  term: Term
}

const Tooltip: React.FC<TooltipProps> = ({ term }) => {
  return (
    <span
      className={css`
        position: relative;
        border-bottom: 1px dotted black;
        > span {
          display: none;
        }

        &:hover {
          > span {
            display: inline;
          }
        }
      `}
    >
      {term.term}

      <span
        className={css`
          position: absolute;
          top: 28px;
          left: calc(100% - 100px);
          /* UI */
          z-index: 2;
          background: white;
          padding: 4px;
          font-size: 12px;
          border: 1px solid black;
          width: 220px;
          border-radius: 4px;
          -webkit-box-shadow: 2px 2px 3px 0px rgba(0, 0, 0, 0.2);
          box-shadow: 2px 2px 3px 0px rgba(0, 0, 0, 0.2);
        `}
      >
        {term.definition}
      </span>
      <span
        className={css`
          position: absolute;
          width: 0px;
          height: 0px;
          z-index: 2;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 5px solid black;
          top: 23px;
          left: 40%;
        `}
      />
      <span
        className={css`
          position: absolute;
          z-index: 2;
          width: 0px;
          height: 0px;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 5px solid white;
          top: 24px;
          left: 40%;
        `}
      />
    </span>
  )
}

export default withErrorBoundary(Tooltip)
