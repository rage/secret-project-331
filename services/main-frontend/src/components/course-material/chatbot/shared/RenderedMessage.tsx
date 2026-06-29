"use client"

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
import { planCitationPortals } from "@/utils/course-material/chatbotCitationPortals"
import { REMOVE_CITATIONS_REGEX } from "@/utils/course-material/chatbotCitationRegexes"
import { getRemarkable } from "@/utils/course-material/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

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
  citationNumberingMap: Map<number, number>
  citationButtonClicked: boolean
  currentTriggerId: string | undefined
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
  citationNumberingMap,
  citationButtonClicked,
  currentTriggerId,
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
    const nodes = Array.from(
      thisNode.current?.querySelectorAll<Element>(PORTAL_PLACEHOLDER_QUERY_SELECTOR) ?? [],
    )
    // planCitationPortals decides, per placeholder node, whether to render a citation button
    // (and with which numbers) from each node's own data-citation-n attribute. Doing it per
    // node — rather than positionally indexing a separately-filtered citation list — keeps a
    // marker that references a non-existent citation (e.g. 【x:0†source】) from misaligning the
    // citations that follow it (which used to throw).
    const plans = planCitationPortals(nodes, citationNumberingMap)
    return nodes.map((node, idx) => {
      const plan = plans[idx]
      if (plan === null) {
        return createPortal(null, node, idx)
      }
      return createPortal(
        <CitationButton
          citN={plan.rawCitN.toString()}
          citNToShow={plan.citN.toString()}
          idx={idx.toString()}
          citationButtonClicked={citationButtonClicked}
          hoverCitationProps={hoverCitationProps}
          currentTriggerId={currentTriggerId}
          handleClick={handleClick}
        />,
        node,
        idx,
      )
    })
  }, [
    citationButtonClicked,
    citationNumberingMap,
    currentTriggerId,
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
