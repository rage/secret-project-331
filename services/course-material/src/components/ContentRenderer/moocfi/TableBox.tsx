import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import useMedia from "../../../shared-module/hooks/useMedia"
import { baseTheme, headingFont, primaryFont } from "../../../shared-module/styles"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import withNoSsr from "../../../shared-module/utils/withNoSsr"
import InnerBlocks from "../util/InnerBlocks"

interface TableBoxAttributes {
  width: string
}

const TableBox: React.FC<React.PropsWithChildren<BlockRendererProps<TableBoxAttributes>>> = (
  props,
) => {
  const width = props.data.attributes?.width

  // eslint-disable-next-line i18next/no-literal-string
  const smallScreen = useMedia(`@media (max-width: ${width}px)`)
  const isFullWidth = smallScreen || !width

  return (
    <div
      className={css`
        width: 100%;
        margin: 1rem auto;

        ${respondToOrLarger.md} {
          width: ${isFullWidth ? "100%" : `${width}px`};
        }
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

          tfoot {
            border-top: none !important;

            th {
              background-color: ${baseTheme.colors.green[200]};
              text-align: left;
              color: ${baseTheme.colors.green[600]};
              border: none !important;
            }
          }

          td {
            background-color: ${baseTheme.colors.green[100]};
            align-items: center;
            padding: 10px;
            color: ${baseTheme.colors.green[700]};
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
            color: ${baseTheme.colors.gray[600]};
            margin-top: 10px;
          }
        `}
      >
        <InnerBlocks parentBlockProps={props} />
      </div>
    </div>
  )
}

export default withNoSsr(withErrorBoundary(TableBox))
