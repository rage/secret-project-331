import { css } from "@emotion/css"
import { MinusCircle, PlusCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import Button from "@/shared-module/common/components/Button"
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
      role="presentation"
      onKeyDown={() => (open ? setOpen(false) : setOpen(true))}
      onClick={() => (open ? setOpen(false) : setOpen(true))}
    >
      <div
        className={css`
          display: flex;
          flex-direction: row;
          font-family: ${headingFont};
          color: #4c5868;
          ${open ? "padding-bottom: 1rem;" : ""}
        `}
      >
        <Button variant={"icon"} size={"small"}>
          {open ? (
            <MinusCircle size={18} color="#4C5868" />
          ) : (
            <PlusCircle size={18} color="#4C5868" />
          )}
        </Button>
        <h4
          className={css`
            font-weight: ${fontWeights.semibold};
          `}
        >
          {heading}
        </h4>
      </div>

      {open && (
        <div
          className={css`
            background: ${baseTheme.colors.primary[100]};
            border-radius: 2px;

            padding-right: 21px;
            padding-left: 16px;
          `}
        >
          <InnerBlocks parentBlockProps={props} />
        </div>
      )}
    </div>
  )
}

const exported = withErrorBoundary(ExpandableContentInnerBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
