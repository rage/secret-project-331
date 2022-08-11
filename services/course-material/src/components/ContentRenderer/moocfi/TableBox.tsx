import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import { baseTheme, headingFont, primaryFont } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface Cell {
  content: string
  tag: string
}

const TableBox: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (props) => {
  const innerBlocks: any = props.data.innerBlocks[0]
  return (
    innerBlocks && (
      <div
        className={css`
          background-color: ${baseTheme.colors.green[200]};
          margin: 1rem 0;
          min-height: 100%;
          padding-bottom: 6px;
          overflow-x: auto;
        `}
      >
        <div
          className={css`
            display: grid;
            grid-template-columns: repeat(${innerBlocks.attributes?.head[0].cells.length}, 1fr);
            min-height: 45px;
            grid-gap: 5px;
          `}
        >
          {innerBlocks.attributes?.head[0].cells.map((item: Cell) => (
            <div
              className={css`
                background-color: ${baseTheme.colors.green[500]};
                display: flex;
                align-items: center;
                margin-bottom: 5px;
                font-family: ${headingFont};
                font-size: 18px;
                font-weight: bold;
                color: #ffffff;
                padding: 12px 10px;
              `}
              key={item.content}
            >
              {item.content}
            </div>
          ))}
        </div>

        {innerBlocks.attributes?.body.map((item: any) => (
          <div
            className={css`
              display: grid;
              grid-template-columns: repeat(${item.cells.length}, 1fr);
              gap: 5px;
              margin-bottom: 5px;

              :last-of-type {
                margin-bottom: 0;
              }
            `}
            key={item.id}
          >
            {item.cells.map((o: Cell) => (
              <div
                className={css`
                  background-color: #f9f9f9;
                  display: flex;
                  align-items: center;
                  padding: 10px;
                  color: #1a2333;
                  font-family: ${primaryFont};
                  font-size: 18px;
                  font-weight: 500;
                  height: auto;
                `}
                key={o.content}
              >
                {o.content}
              </div>
            ))}
          </div>
        ))}
        {innerBlocks.attributes?.foot[0] && (
          <div
            className={css`
              display: grid;
              grid-template-columns: repeat(${innerBlocks.attributes?.foot[0].cells.length}, 1fr);
              height: 45px;
              grid-gap: 5px;
            `}
          >
            {innerBlocks.attributes?.foot[0].cells.map((item: Cell) => (
              <div
                className={css`
                  background-color: ${baseTheme.colors.green[100]};
                  display: flex;
                  align-items: center;
                  margin-bottom: 5px;
                  font-size: 18px;
                  color: #1a2333;
                  padding: 10px;
                `}
                key={item.content}
              >
                {item.content}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  )
}

export default withErrorBoundary(TableBox)
