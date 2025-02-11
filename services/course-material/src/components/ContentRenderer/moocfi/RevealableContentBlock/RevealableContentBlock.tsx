import { css } from "@emotion/css"
import { t } from "i18next"
import React, { useState } from "react"

import ContentRenderer, { BlockRendererProps } from "../.."

import { Block } from "@/services/backend"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface RevealableContentProps {}

const RevealableContentBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<RevealableContentProps>>
> = (props) => {
  const [open, setOpen] = useState(false)

  const reveleadContent: Block<RevealableContentProps>[] = []
  const hiddenContent: Block<RevealableContentProps>[] = []
  props.data.innerBlocks.map((content) => {
    if (content.name === "moocfi/revealable-hidden-content") {
      hiddenContent.push(content as Block<RevealableContentProps>)
    } else {
      reveleadContent.push(content as Block<RevealableContentProps>)
    }
  })

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          padding: 1rem;
          background: #f2f2f2;
          color: #4c5868;
        `}
      >
        <Centered variant={"narrow"}>
          {reveleadContent.map((content) => (
            <ContentRenderer
              key={content.clientId}
              data={[content]}
              editing={false}
              selectedBlockId={null}
              setEdits={function (): void {
                throw new Error("Function not implemented.")
              }}
              isExam={false}
            />
          ))}
          {!open && (
            <Button
              variant={"tertiary"}
              size={"medium"}
              transform={"capitalize"}
              onClick={() => setOpen(!open)}
            >
              {t("button-text-proceed-after-thinking")}
            </Button>
          )}
          {open &&
            hiddenContent.map((content) => (
              <ContentRenderer
                key={content.clientId}
                data={[content]}
                editing={false}
                selectedBlockId={null}
                setEdits={function (): void {
                  throw new Error("Function not implemented.")
                }}
                isExam={false}
              />
            ))}
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(RevealableContentBlock)
