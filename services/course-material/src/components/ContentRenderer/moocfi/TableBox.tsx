import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import { baseTheme, headingFont, primaryFont } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

const TableBox: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (props) => {
  return (
    <div
      className={css`
        margin: 1rem 0;
      `}
    >
      <div
        className={css`
          margin: 1rem 0;
          min-height: 100%;
          padding-bottom: 6px;
          overflow-x: auto;

          table {
            border-collapse: unset !important;
          }

          thead {
            border-bottom: none !important;
          }

          tfoot {
            border-top: none !important;

            th {
              background-color: ${baseTheme.colors.green[200]};
              text-align: left;
              color: ${baseTheme.colors.green[600]};
              border: none !important;
            }
          }

          th {
            background-color: ${baseTheme.colors.green[500]};
            align-items: center;
            margin-bottom: 5px;
            font-family: ${headingFont};
            font-size: 17px;
            font-weight: bold;
            color: #ffffff;
            padding: 12px 10px;
            border: none;
          }

          td {
            background-color: ${baseTheme.colors.green[100]};
            align-items: center;
            padding: 10px;
            color: ${baseTheme.colors.green[600]};
            font-family: ${primaryFont};
            font-size: 18px;
            font-weight: 500;
            height: auto;
            border: none !important;
            margin-right: 20px;
          }

          caption {
            font-size: 15px;
            text-align: center;
            color: ${baseTheme.colors.grey[600]};
            margin-top: 10px;
          }
        `}
      >
        <InnerBlocks parentBlockProps={props} />
      </div>
    </div>
  )
}

export default withErrorBoundary(TableBox)
