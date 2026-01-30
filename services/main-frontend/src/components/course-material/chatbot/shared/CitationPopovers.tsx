"use client"

import { RefObject, SetStateAction } from "react"

import CitationPopover from "./CitationPopover"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface CitationPopoversProps {
  citations: ChatbotConversationMessageCitation[]
  citationNumberingMap: Map<number, number>
  triggerElement: RefObject<HTMLButtonElement | null>
  triggerElementId: string
  setTriggerElementId: (value: SetStateAction<string>) => void
  citationButtonClicked: boolean
  setCitationButtonClicked: (value: SetStateAction<boolean>) => void
  isCitationHovered: boolean
}

const CitationPopovers: React.FC<CitationPopoversProps> = (props) => {
  const { citations, citationNumberingMap } = props
  return (
    <>
      {citations.map((citation, idx) => {
        const citationNumber = assertNotNullOrUndefined(
          citationNumberingMap.get(citation.citation_number),
        )
        return (
          <CitationPopover
            key={idx}
            citation={citation}
            citationNumber={citationNumber}
            {...props}
          />
        )
      })}
    </>
  )
}

export default CitationPopovers
