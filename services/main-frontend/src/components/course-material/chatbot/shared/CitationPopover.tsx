"use client"

import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import { RefObject, SetStateAction, useEffect, useMemo, useRef, useState } from "react"
import { useHover } from "react-aria"
import { OverlayTriggerStateContext } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { citationId } from "./CitationButton"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import SpeechBalloonPopover from "@/shared-module/common/components/SpeechBalloonPopover"
import { baseTheme } from "@/shared-module/common/styles"
import { getRemarkable } from "@/utils/course-material/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

interface CitationPopoverProps {
  citation: ChatbotConversationMessageCitation
  citationNumber: number
  triggerElement: RefObject<HTMLButtonElement | null>
  triggerElementId: string
  setTriggerElementId: (value: SetStateAction<string>) => void
  citationButtonClicked: boolean
  setCitationButtonClicked: (value: SetStateAction<boolean>) => void
  isCitationHovered: boolean
}

let md = getRemarkable()

const CitationPopover: React.FC<CitationPopoverProps> = ({
  citation,
  citationNumber,
  triggerElement,
  triggerElementId,
  setTriggerElementId,
  citationButtonClicked,
  setCitationButtonClicked,
  isCitationHovered,
}) => {
  const { t } = useTranslation()
  const popoverRef = useRef<HTMLElement>(null)
  let [isPopoverOpen, setIsPopoverOpen] = useState(false)
  let { hoverProps: hoverPopoverProps, isHovered: isPopoverHovered } = useHover({})

  useEffect(() => {
    let open = isCitationHovered || isPopoverHovered || citationButtonClicked
    setIsPopoverOpen(open)
  }, [citationButtonClicked, isCitationHovered, isPopoverHovered, triggerElementId])

  useEffect(() => {
    const removeListenersAbortController = new AbortController()
    const currentRef = popoverRef.current
    currentRef?.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsPopoverOpen(false)
          setCitationButtonClicked(false)
          triggerElement.current = null
          setTriggerElementId("")
        }
      },
      { signal: removeListenersAbortController.signal },
    )

    return () => {
      removeListenersAbortController.abort()
    }
  }, [
    popoverRef,
    isPopoverOpen,
    setIsPopoverOpen,
    citationButtonClicked,
    triggerElement,
    setTriggerElementId,
    setCitationButtonClicked,
  ])

  const citationContent: string = useMemo(() => {
    return md.render(citation.content)
  }, [citation.content])

  return (
    <OverlayTriggerStateContext.Provider
      // this provider prevents the DialogTrigger higher in the DOM from
      // controlling the dialog inside SpeechBalloonPopover
      value={{
        isOpen: false,
        setOpen: () => {
          //NOP
        },
        open: () => {
          //NOP
        },
        close: () => {
          //NOP
        },
        toggle: () => {
          //NOP
        },
      }}
    >
      <SpeechBalloonPopover
        popoverRef={popoverRef}
        placement="top"
        triggerRef={triggerElement}
        isOpen={Boolean(
          triggerElementId.includes(
            // the triggerElement's id will contain the citationId's first part
            // if it's associated with this citation
            citationId(citation.citation_number.toString(), ""),
          ) && isPopoverOpen,
        )}
        isNonModal={!citationButtonClicked}
        onOpenChange={() => {
          setCitationButtonClicked(false)
          setTriggerElementId("")
        }}
        popoverLabel={t("citation-n", { n: citationNumber })}
        {...hoverPopoverProps}
      >
        <span
          className={css`
            overflow-wrap: break-word;
            height: fit-content;
            max-height: 5lh;
            margin-bottom: 0.5em;
            mask-image: linear-gradient(0.5turn, black 66%, transparent);
            h1 {
              font-size: 1.8rem;
            }
            h2 {
              font-size: 1.5rem;
            }
            h3 {
              font-size: 1.2rem;
            }
            h4 {
              font-size: 1rem;
            }
            h5 {
              font-size: 0.8rem;
            }
            h6 {
              font-size: 0.6rem;
            }
          `}
          dangerouslySetInnerHTML={{
            __html: sanitizeCourseMaterialHtml(citationContent),
          }}
        ></span>
        <p
          className={css`
            display: flex;
            justify-content: space-between;
            flex-flow: row nowrap;
            position: relative;
            gap: 10px;
          `}
        >
          <a
            href={citation.document_url}
            className={css`
              color: ${baseTheme.colors.blue[700]};
              &::after {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
              }
              &:focus {
                outline: 2px solid ${baseTheme.colors.green[400]};
              }
            `}
          >
            <span>
              <b>
                {citation.course_material_chapter_number &&
                  `${t("chapter-chapter-number", {
                    number: citation.course_material_chapter_number,
                  })}: `}
                {`${citation.title}`}
              </b>
            </span>
          </a>
          <Library
            className={css`
              align-self: flex-end;
              width: 3em;
              margin-right: -5px;
            `}
          />
        </p>
      </SpeechBalloonPopover>
    </OverlayTriggerStateContext.Provider>
  )
}

export default CitationPopover
