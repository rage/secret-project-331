import { css } from "@emotion/css"
import { SetStateAction } from "react"

import { BlockRendererProps } from "../.."
import { Block } from "../../../../services/backend"
import { NewProposedBlockEdit } from "../../../../shared-module/bindings"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import colorMapper from "../../../../styles/colorMapper"
import { ColumnAttributes, ColumnsAttributes } from "../../../../types/GutenbergBlockAttributes"

import ColumnBlock from "./ColumnBlock"

const ColumnsBlock: React.FC<BlockRendererProps<ColumnsAttributes>> = ({ data }) => {
  const innerBlocks = data.innerBlocks as Block<ColumnAttributes>[]
  const {
    isStackedOnMobile,
    // align,
    anchor,
    backgroundColor,
    // className,
    gradient,
    // style,
    textColor,
    verticalAlignment,
  } = data.attributes

  return (
    <div
      className={css`
        /* This respondToOrLarger should be kept on top,
          as this has some stylelint parsing error in pre-commit hook, probably related to:
          https://github.com/stylelint/stylelint/issues/4401
        */
        ${respondToOrLarger.md} {
          div:not(:first-child) {
            margin-left: 2rem;
          }
          flex-wrap: nowrap;
        }

        ${courseMaterialCenteredComponentStyles}
        ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
        ${gradient && `background: ${colorMapper(gradient)};`}
        ${textColor && `color: ${colorMapper(textColor)};`}
        ${verticalAlignment && `align-items: ${verticalAlignment};`}
        ${
          (backgroundColor || gradient) &&
          "padding: 1.25rem 2.375rem !important;" /* We want to have padding around the child column divs if bg set */
        }
        display: flex;
        flex-wrap: wrap;

        ${
          isStackedOnMobile &&
          respondToOrLarger.md &&
          "> div { width: 100%; }" /* Ensure width 100% for child divs */
        }
        ${
          !isStackedOnMobile &&
          "div:not(:first-child) { margin-left: 2rem; }" /* Ensure that margin-left for div #2> is on mobile if not stacked enabled */
        }
      `}
      {...(anchor && { id: anchor })}
    >
      {innerBlocks.map((block) => {
        return (
          <ColumnBlock
            key={block.clientId}
            data={block}
            editing={false}
            selectedBlockId={null}
            setEdits={function (_value: SetStateAction<Map<string, NewProposedBlockEdit>>): void {
              throw new Error("Function not implemented.")
            }}
            id={block.clientId}
          />
        )
      })}
    </div>
  )
}

export default ColumnsBlock
