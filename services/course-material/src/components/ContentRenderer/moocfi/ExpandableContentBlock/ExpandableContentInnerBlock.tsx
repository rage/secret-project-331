import { css } from "@emotion/css"
import { MinusCircle, PlusCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import Button from "@/shared-module/common/components/Button"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExpandableContentInnerBlockProps {
  name: string
}

const ExpandableContentInnerBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExpandableContentInnerBlockProps>>
> = (props) => {
  const heading = props.data.attributes.name

  const [x, setX] = useState(0)
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        padding: 2rem;
        border: 2px solid gray;
        border-bottom: 0;
        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
          margin-top: 0;
        }

        border-left: ${x === 1 ? "4px solid black" : "2px solid gray"};
      `}
      role="presentation"
      onKeyDown={() => (x === 0 ? setX(1) : setX(0))}
      onClick={() => (x === 0 ? setX(1) : setX(0))}
    >
      <div
        className={css`
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          width: 100%;
        `}
      >
        <div>{heading}</div>
        <Button variant={"icon"} size={"small"}>
          {x == 0 ? <PlusCircle /> : <MinusCircle />}
        </Button>
      </div>

      {x == 1 && <InnerBlocks parentBlockProps={props} />}
    </div>
  )
}

const exported = withErrorBoundary(ExpandableContentInnerBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
