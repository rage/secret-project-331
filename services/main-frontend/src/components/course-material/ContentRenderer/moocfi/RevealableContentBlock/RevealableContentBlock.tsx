"use client"

import { css } from "@emotion/css"
import { t } from "i18next"
import React, { useEffect, useRef, useState } from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components"
import type { Block } from "@/types/courseMaterialBlock"

import type { BlockRendererProps } from "../.."
import ContentRenderer from "../.."

// oxlint-disable-next-line typescript/no-empty-object-type
interface RevealableContentProps {}

const RevealableContentBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<RevealableContentProps>>
> = (props) => {
  const [open, setOpen] = useState(false)
  const revealedRef = useRef<HTMLDivElement>(null)

  // The button unmounts on reveal, so move focus to the revealed content.
  useEffect(() => {
    if (open) {
      revealedRef.current?.focus()
    }
  }, [open])

  const reveleadContent: Block<RevealableContentProps>[] = []
  const hiddenContent: Block<RevealableContentProps>[] = []
  props.data.innerBlocks.forEach((content) => {
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
            <ContentRenderer key={content.clientId} data={[content]} isExam={false} />
          ))}
          {!open && (
            <Button variant={"tertiary"} size={"medium"} onClick={() => setOpen(!open)}>
              {t("button-text-proceed-after-thinking")}
            </Button>
          )}
          {open && (
            <div
              ref={revealedRef}
              tabIndex={-1}
              className={css`
                outline: none;
              `}
            >
              {hiddenContent.map((content) => (
                <ContentRenderer key={content.clientId} data={[content]} isExam={false} />
              ))}
            </div>
          )}
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(RevealableContentBlock)
