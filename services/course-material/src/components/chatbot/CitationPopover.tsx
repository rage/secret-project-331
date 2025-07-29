import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { useId } from "react"

import { hrefStyle } from "./styles"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import SpeechBalloon from "@/shared-module/common/components/SpeechBalloon"

interface CitationPopoverProps {
  id: string
  linkId: string
  setPopperElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  setHoverPopperElement: (value: React.SetStateAction<boolean>) => void
  setReferenceElement: (value: React.SetStateAction<HTMLButtonElement | null>) => void
  focusOnRefElement: () => void
  citation: ChatbotConversationMessageCitation
  popperStyles: React.CSSProperties
  popperAttributes:
    | {
        [key: string]: string
      }
    | undefined
}

const popoverStyle = css`
  z-index: 100;
  animation: fadeIn 0.2s ease-in-out;
  pointer-events: auto;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  p {
    overflow-wrap: break-word;
    width: 300px;
    max-width: 90vw;
  }
  ${hrefStyle}
`

const CitationPopover: React.FC<CitationPopoverProps> = ({
  id,
  linkId,
  setPopperElement,
  setHoverPopperElement,
  setReferenceElement,
  focusOnRefElement,
  citation,
  popperStyles,
  popperAttributes,
}) => {
  const popLabelId = useId()
  const popDescribeId = useId()

  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={popLabelId}
      aria-describedby={popDescribeId}
      ref={setPopperElement}
      className={popoverStyle}
      /* eslint-disable-next-line react/forbid-dom-props */
      style={popperStyles}
      onMouseEnter={() => {
        setHoverPopperElement(true)
      }}
      onMouseLeave={() => {
        setHoverPopperElement(false)
      }}
      onFocus={() => {
        console.log("focusing on popover")
      }}
      onBlur={(e) => {
        if (e.relatedTarget?.id === `cit-${citation.citation_number}`) {
          return
        }
        setReferenceElement(null)
      }}
      {...popperAttributes}
    >
      <SpeechBalloon
        className={css`
          display: flex;
          flex-flow: column nowrap;
        `}
      >
        <p
          id={popDescribeId}
          className={css`
            mask-image: linear-gradient(0.5turn, black 66%, transparent);
          `}
        >
          {citation.content}
        </p>
        <p
          id={popLabelId}
          className={css`
            display: flex;
            justify-content: space-between;
            flex-flow: row nowrap;
            position: relative;

            a::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            }
          `}
        >
          <a
            href={citation.document_url}
            id={linkId}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                focusOnRefElement()
                setReferenceElement(null)
              }
            }}
          >
            <span>
              <b>
                {citation.course_material_chapter}: {citation.title}
              </b>
            </span>
          </a>
          <Library size={18} />
        </p>
      </SpeechBalloon>
    </div>
  )
}

export default React.memo(CitationPopover)
