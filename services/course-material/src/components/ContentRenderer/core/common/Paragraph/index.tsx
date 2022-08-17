import { css } from "@emotion/css"
import { diffChars } from "diff"
import KaTex from "katex"
import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"
import * as ReactDOMServer from "react-dom/server"
import { useMemo } from "use-memo-one"

import { BlockRendererProps } from "../../.."
import { ParagraphAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { Term } from "../../../../../shared-module/bindings"
import DiffFormatter from "../../../../../shared-module/components/DiffFormatter"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

const Paragraph = dynamic(() => import("./BasicParagraph"))
const LatexParagraph = dynamic(() => import("./LatexParagraph"))

const LATEX_REGEX = /\[latex\](.*?)\[\/latex\]/g
const LATEX_CITE_REGEX = /\\cite{(.*?)}/g
const HTML_ESCAPED_AMPERSAND = "&amp;"
const KATEX_OUTPUT_FORMAT = "htmlAndMathml"

/**
 *
 * @param data HTML-content from the server
 * @returns HTML as string in which "[latex] ... [/latex]" will be replaced with katex
 */
const convertToLatex = (data: string) => {
  let count = 0
  const converted = data.replace(LATEX_REGEX, (_, latex) => {
    // Convert ampersand back to special symbol. This is needed e.g. in matrices
    const processed = latex.replaceAll(HTML_ESCAPED_AMPERSAND, "&")
    count++
    return KaTex.renderToString(processed, {
      throwOnError: false,
      output: KATEX_OUTPUT_FORMAT,
    })
  })

  return { count, converted }
}

interface TooltipProps {
  term: Term
}

const Tooltip: React.FC<TooltipProps> = ({ term }) => {
  return (
    <span
      className={css`
        position: relative;
        border-bottom: 1px dotted black;
        > span {
          display: none;
        }

        &:hover {
          > span {
            display: inline;
          }
        }
      `}
    >
      {term.term}

      <span
        className={css`
          position: absolute;
          top: 28px;
          left: 0px;
          /* UI */
          background: white;
          padding: 4px;
          font-size: 12px;
          border: 1px solid black;
          width: 220px;
          border-radius: 4px;
        `}
      >
        {term.definition}
      </span>
      <span
        className={css`
          position: absolute;
          width: 0px;
          height: 0px;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 5px solid black;
          top: 23px;
          left: 5px;
        `}
      />
      <span
        className={css`
          position: absolute;
          width: 0px;
          height: 0px;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 5px solid white;
          top: 24px;
          left: 5px;
        `}
      />
    </span>
  )
}

const generateToolTip = (term: Term) => {
  return ReactDOMServer.renderToString(<Tooltip term={term} />)
}

const parseGlossary = (data: string, glossary: Term[]): string => {
  const terms: { [term: string]: Term } = {}

  glossary.forEach((item) => {
    terms[item.term] = item
  })

  return data
    .split(" ")
    .map((val, _) => (terms[val] !== undefined ? generateToolTip(terms[val]) : val))
    .join(" ")
}

const parseCitation = (data: string) => {
  const converted = data.replace(
    LATEX_CITE_REGEX,
    // eslint-disable-next-line i18next/no-literal-string
    (_, citationId) => `<sup class="reference" data-citation-id=${citationId}>[?]</sup>`,
  )
  return converted
}

const hasDropCap = css`
  :first-letter {
    float: left;
    font-size: 8.4em;
    line-height: 0.68;
    font-weight: 100;
    margin: 0.05em 0.1em 0 0;
    text-transform: uppercase;
    font-style: normal;
  }
`

const parseText = (content: string, terms: Term[]) => {
  const sanitizedHTML = sanitizeCourseMaterialHtml(content)
  const { count, converted: parsedLatex } = convertToLatex(sanitizedHTML)
  const parsedCitation = parseCitation(parsedLatex)
  const parsedGlossary = parseGlossary(parsedCitation, terms ?? [])

  return { count, parsedText: parsedGlossary }
}

const ParagraphBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ParagraphAttributes>>
> = ({ data, id, editing, selectedBlockId, setEdits, terms }) => {
  const {
    textColor,
    backgroundColor,
    fontSize,
    content,
    dropCap,
    align,
    anchor,
    // className, Additional classNames added in Advanced menu
    // direction, If read from right to left or left to right
    // style,
  } = data.attributes

  // If background color is undefined, it indicates a transparent background
  // and we let the background color property unset in CSS.
  // eslint-disable-next-line i18next/no-literal-string
  const bgColor = colorMapper(backgroundColor, "unset")
  const [editedContent, setEditedContent] = useState(data.attributes.content)

  // edited content should not persist between edit proposals
  // reset edited content when no longer editing
  useEffect(() => {
    if (!editing && editedContent !== data.attributes.content) {
      setEditedContent(data.attributes.content)
    }
  }, [data.attributes.content, editedContent, editing])

  // this value only changes when the selection changes, making sure the content of the div being edited isn't constantly changed under the user
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedContent = useMemo(() => editedContent, [selectedBlockId])

  if (editing) {
    if (selectedBlockId === id) {
      // block focused, editing
      return (
        <p
          className={css`
            margin: 1.25rem 0;
            min-width: 1px;
            color: ${textColor};
            background-color: ${backgroundColor};
            font-size: ${fontSize};
            ${backgroundColor && `padding: 1.25em 2.375em;`}
            border: 1px;
            border-style: dotted;
          `}
          contentEditable
          onInput={(ev) => {
            const changed = ev.currentTarget.innerText
            setEditedContent(changed)
            if (content !== changed) {
              setEdits((edits) => {
                edits.set(id, {
                  block_id: id,
                  block_attribute: "content",
                  original_text: content,
                  changed_text: changed,
                })
                return new Map(edits)
              })
            } else {
              // returned to original
              setEdits((edits) => {
                edits.delete(id)
                return new Map(edits)
              })
            }
          }}
        >
          {memoizedContent}
        </p>
      )
    } else {
      const diffChanges = diffChars(data.attributes.content, editedContent)

      return (
        <p
          className={css`
            margin: 1.25rem 0;
            min-width: 1px;
            color: ${textColor};
            background-color: ${backgroundColor};
            font-size: ${fontSize};
            ${backgroundColor && `padding: 1.25em 2.375em;`}
          `}
        >
          <DiffFormatter changes={diffChanges} />
        </p>
      )
    }
  }

  const { count, parsedText } = parseText(content, terms ?? [])
  const P = count > 0 ? LatexParagraph : Paragraph

  return (
    <P
      className={css`
        ${dropCap ? hasDropCap : null}
        margin: 1.25rem 0;
        min-width: 1px;
        color: ${colorMapper(textColor)};
        background-color: ${bgColor};
        font-size: ${fontSizeMapper(fontSize)};
        line-height: 1.6;
        text-align: ${align ?? "left"};
        ${backgroundColor && `padding: 1.25em 2.375em !important;`}
      `}
      dangerouslySetInnerHTML={{
        __html: parsedText,
      }}
      {...(anchor ? { id: anchor } : {})}
    />
  )
}

export default ParagraphBlock
