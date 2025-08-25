import { css } from "@emotion/css"
import React, { DOMAttributes, memo, ReactPortal, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import CitationButton from "./CitationButton"

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import { getRemarkable } from "@/utils/getRemarkable"
import { sanitizeCourseMaterialHtml } from "@/utils/sanitizeCourseMaterialHtml"

// matches citations and a starting whitespace that should be removed
export const REMOVE_CITATIONS_REGEX = /\s*?\[[\w]*?[\d]+\]/g

const md = getRemarkable()

const messageStyle = css`
  flex: 1;
  & > * {
    margin: 0rem auto 0.85em;
  }
  *:last-child {
    margin: 0;
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
    cursor: default;
    background-color: ${baseTheme.colors.gray[200]};
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
    font-size: x-large;
  }
  h2 {
    font-size: large;
  }
  h3 {
    font-size: medium;
  }
  h4,
  h5,
  h6 {
    font-size: small;
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
  /** memo the rendered message with the portal targets so that it won't be rerendered when the
   portals are created */
  return (
    <>
      <span
        className={messageStyle}
        dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(msg) }}
      ></span>
    </>
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
  const [readyForPortal, setReadyForPortal] = useState(false)

  useEffect(() => {
    if (renderOption == MessageRenderType.ChatbotWithCitations) {
      setReadyForPortal(true)
    } else {
      setReadyForPortal(false)
    }
  }, [renderOption])

  if (renderOption === MessageRenderType.User) {
    return <span className={messageStyle}>{message}</span>
  }

  if (renderOption === MessageRenderType.ChatbotNoCitations) {
    let renderedMessage = message.replace(REMOVE_CITATIONS_REGEX, "")
    renderedMessage = md.render(renderedMessage.trim()).trim().slice(3, -4)
    return (
      <span
        className={messageStyle}
        dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(renderedMessage) }}
      ></span>
    )
  }

  let renderedMessage = md.render(message.trim())
  console.log("rendering renderedMessage")
  let portals: ReactPortal[] = []
  if (readyForPortal) {
    // eslint-disable-next-line i18next/no-literal-string
    thisNode.current?.querySelectorAll("[data-chatbot-citation='true']").forEach((node, idx) => {
      console.log("elemnt found", node)
      // the citedDocs list contains the citation numbers in the order of appearance in the msg
      // the nodelist contains the citations in the order of appearance in the msg
      // the same idx can be used
      let citN = (citationNumberingMap.get(citedDocs[idx]) ?? "").toString()

      portals.push(
        createPortal(
          <CitationButton
            citN={citN}
            idx={idx.toString()}
            citationButtonClicked={citationButtonClicked}
            hoverCitationProps={hoverCitationProps}
            currentRefId={currentRefId}
            handleClick={handleClick}
          />,
          node,
          idx,
        ),
      )
    })
  }

  return (
    <span ref={thisNode}>
      <MessageWithPortalsComponent msg={renderedMessage} />
      {readyForPortal && portals}
    </span>
  )
}

export default RenderedMessage
