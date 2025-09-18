import { css } from "@emotion/css"
import React, {
  DOMAttributes,
  memo,
  ReactPortal,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import CitationButton from "./CitationButton"

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import { nodeIsElement } from "@/shared-module/common/utils/dom"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { REMOVE_CITATIONS_REGEX } from "@/utils/chatbotCitationRegexes"
import { getRemarkable } from "@/utils/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

const PORTAL_PLACEHOLDER_QUERY_SELECTOR = "[data-chatbot-citation='true']"

const md = getRemarkable()

const messageStyle = css`
  flex: 1;
  & > * {
    margin: 0 auto 0.85em;
  }
  p:last-child {
    margin: 0 auto;
  }
  table {
    margin: 20px 0 20px 0;
    border-collapse: collapse;
  }
  thead {
    background-color: ${baseTheme.colors.clear[200]};
  }
  tbody td {
    text-align: center;
    padding: 5px;
  }
  tbody tr:nth-child(odd) {
    background-color: #ffffff;
  }
  tbody tr:nth-child(even) {
    background-color: ${baseTheme.colors.clear[200]};
  }
  pre {
    /*the pre element corresponds to md raw text, this property
    will force long strings in it to wrap and not overflow */
    white-space: pre-wrap;
  }
  button {
    /*Citations are inside button tags, it's assumed button tags wouldn't
    be used otherwise in chatbot text*/
    border: none;
    margin-right: 1px;
    cursor: default;
    background-color: ${baseTheme.colors.green[200]};
    font-family: ${monospaceFont};
    padding: 0 0.525em 0 0.525em;
    border-radius: 1em;
    font-size: 85%;
    &:hover {
      filter: brightness(0.9) contrast(1.1);
      transition: filter 0.2s;
    }
  }
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
`

export enum MessageRenderType {
  User,
  ChatbotNoCitations,
  ChatbotWithCitations,
}

interface RenderedMessageProps {
  renderOption: MessageRenderType
  message: string
  citedDocs: number[]
  citationNumberingMap: Map<number, number>
  citationButtonClicked: boolean
  currentRefId: string | undefined
  handleClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  hoverCitationProps: DOMAttributes<HTMLButtonElement>
}

interface MessageWithPortalsComponentProps {
  msg: string
}

const MessageWithPortalsComponent: React.FC<MessageWithPortalsComponentProps> = memo(({ msg }) => {
  /* this span is the parent to the portal containers. memo it so that it won't be
   re-rendered when the portals are created */
  return (
    <span
      className={messageStyle}
      dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(msg) }}
    ></span>
  )
})

MessageWithPortalsComponent.displayName = "MessageWithPortalsComponent"

const RenderedMessage: React.FC<RenderedMessageProps> = ({
  renderOption,
  message,
  citedDocs,
  citationNumberingMap,
  citationButtonClicked,
  currentRefId,
  handleClick,
  hoverCitationProps,
}) => {
  // create a ref for this component so that we don't query the whole document later
  const thisNode = useRef<HTMLElement>(null)
  // the message needs to be rendered before we can put portals in it, so this state is
  // set as true only when the initial render is complete and citations should be shown
  const [readyForPortal, setReadyForPortal] = useState(false)

  useLayoutEffect(() => {
    if (renderOption == MessageRenderType.ChatbotWithCitations) {
      setReadyForPortal(true)
    } else {
      setReadyForPortal(false)
    }
  }, [renderOption])

  let portals: ReactPortal[] | null = useMemo(() => {
    if (!readyForPortal) {
      return null
    }
    return Array.from(
      thisNode.current?.querySelectorAll<Element>(PORTAL_PLACEHOLDER_QUERY_SELECTOR) ?? [],
    ).map((node, idx) => {
      // the citedDocs list contains the citation numbers in the order of appearance in the msg
      // the nodelist contains the citations in the order of appearance in the msg
      // the same idx can be used
      let citN = assertNotNullOrUndefined(citationNumberingMap.get(citedDocs[idx]))

      if (idx !== 0) {
        let prevCitN = assertNotNullOrUndefined(citationNumberingMap.get(citedDocs[idx - 1]))

        // if the previous citation was the same as this, and the previous
        // sibling node is also a citation button (not text), return null
        // because we don't want to cite the same doc multiple times in a row
        if (prevCitN === citN) {
          let prev = node.previousSibling

          if (prev && nodeIsElement(prev)) {
            // double check if the previousSibling is actually a citationButton
            // and actually corresponds to the previous citation
            if (
              parseInt(prev.attributes.getNamedItem("data-citation-n")?.value ?? "") ===
              citedDocs[idx - 1]
            ) {
              return createPortal(null, node, idx)
            }
          }
        }
      }

      return createPortal(
        <CitationButton
          citN={citedDocs[idx].toString()}
          citNToShow={citN.toString()}
          idx={idx.toString()}
          citationButtonClicked={citationButtonClicked}
          hoverCitationProps={hoverCitationProps}
          currentRefId={currentRefId}
          handleClick={handleClick}
        />,
        node,
        idx,
      )
    })
  }, [
    citationButtonClicked,
    citationNumberingMap,
    citedDocs,
    currentRefId,
    handleClick,
    hoverCitationProps,
    readyForPortal,
  ])

  let renderedMessage = useMemo(() => {
    switch (renderOption) {
      case MessageRenderType.User:
        return message
      case MessageRenderType.ChatbotNoCitations:
        return md.render(message.replace(REMOVE_CITATIONS_REGEX, "").trim())
      case MessageRenderType.ChatbotWithCitations:
        return md.render(message.trim())
      default:
        throw new Error("unexpected MessageRenderType")
    }
  }, [message, renderOption])

  if (renderOption === MessageRenderType.User) {
    return <span className={messageStyle}>{renderedMessage}</span>
  }

  if (renderOption === MessageRenderType.ChatbotNoCitations) {
    return (
      <span
        className={messageStyle}
        dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(renderedMessage) }}
      ></span>
    )
  }

  return (
    <span ref={thisNode}>
      <MessageWithPortalsComponent msg={renderedMessage} />
      {readyForPortal && portals}
    </span>
  )
}

export default RenderedMessage
