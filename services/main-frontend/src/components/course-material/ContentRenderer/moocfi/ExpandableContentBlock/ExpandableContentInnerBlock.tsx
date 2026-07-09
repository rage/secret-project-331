"use client"

import { css } from "@emotion/css"
import { MinusCircle, PlusCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"

import { BlockRendererProps } from "../.."

import InnerBlocks from "@/components/course-material/ContentRenderer/util/InnerBlocks"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExpandableContentInnerBlockProps {
  name: string
}

const ExpandableContentInnerBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExpandableContentInnerBlockProps>>
> = (props) => {
  const heading = props.data.attributes.name

  const [open, setOpen] = useState(false)
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        padding: 1rem;
        border-radius: 4px;
        background: #dfdfe480;
      `}
    >
      <button
        type="button"
        className={css`
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          font-family: ${headingFont};
          color: #4c5868;
          cursor: pointer;
          border: 0;
          width: 100%;
          text-align: left;
          background: transparent;
          ${open ? "padding-bottom: 1rem;" : ""}
        `}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? (
          <MinusCircle size={18} color="#4C5868" />
        ) : (
          <PlusCircle size={18} color="#4C5868" />
        )}
        <h4
          className={css`
            font-weight: ${fontWeights.semibold};
          `}
        >
          {heading}
        </h4>
      </button>

      {open && (
        <div
          className={css`
            background: ${baseTheme.colors.primary[100]};
            border-radius: 2px;

            p,
            h1 {
              margin: 9px 21px 9px 16px;
            }
          `}
        >
          <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
        </div>
      )}
    </div>
  )
}

const exported = withErrorBoundary(ExpandableContentInnerBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
