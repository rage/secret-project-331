import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { ColumnAttributes, ColumnsAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { Block } from "../../../../services/backend"

import ColumnBlock from "./ColumnBlock"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ColumnsBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ColumnsAttributes>>> = ({
  data,
  isExam,
}) => {
  const innerBlocks = data.innerBlocks as Block<ColumnAttributes>[]
  const {
    isStackedOnMobile,
    // align,
    // className,

    // style,

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
        ${verticalAlignment && `align-items: ${verticalAlignment};`}
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
    >
      {innerBlocks.map((block) => {
        return <ColumnBlock key={block.clientId} data={block} id={block.clientId} isExam={isExam} />
      })}
    </div>
  )
}

export default withErrorBoundary(ColumnsBlock)
