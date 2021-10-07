import { css } from "@emotion/css"
import { diffChars } from "diff"
import KaTex from "katex"
import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"
import sanitizeHtml from "sanitize-html"
import { useMemo } from "use-memo-one"

import { BlockRendererProps } from "../"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import colorMapper from "../../../styles/colorMapper"
import fontSizeMapper from "../../../styles/fontSizeMapper"
import { ParagraphAttributes } from "../../../types/GutenbergBlockAttributes"

const Paragraph = dynamic(() => import("./BasicParagraph"))
const LatexParagraph = dynamic(() => import("./LatexParagraph"))

const LATEX_REGEX = /\[latex\](.*)\[\/latex\]/g

/**
 *
 * @param data HTML-content from the server
 * @returns HTML as string in which "[latex] ... [/latex]" will be replaced with katex
 */
const convertToLatex = (data: string) => {
  let count = 0
  const converted = data.replace(LATEX_REGEX, (_, latex) => {
    // Convert ampersand back to special symbol. This is needed e.g. in matrices
    const processed = latex.replaceAll("&amp;", "&")
    count++
    return KaTex.renderToString(processed, {
      throwOnError: false,
      output: "html",
    })
  })

  return { count, converted }
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

const ParagraphBlock: React.FC<BlockRendererProps<ParagraphAttributes>> = ({
  data,
  id,
  editing,
  selectedBlockId,
  setEdits,
}) => {
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
            ${courseMaterialCenteredComponentStyles}
            white-space: pre-line;
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
      const spans: JSX.Element[] = []
      for (const diff of diffChars(data.attributes.content, editedContent)) {
        // the diff spans should have the block id so the click handler can find it
        if (diff.added) {
          spans.push(
            <mark
              aria-roledescription={"Removed text"}
              className={css`
                background: ${colorMapper("pale-cyan-blue")};
              `}
            >
              {diff.value}
            </mark>,
          )
        } else if (diff.removed) {
          spans.push(
            <mark
              aria-roledescription={"Added text"}
              className={css`
                background: ${colorMapper("luminous-vivid-orange")};
              `}
            >
              {diff.value}
            </mark>,
          )
        } else {
          spans.push(<span>{diff.value}</span>)
        }
      }
      return (
        <p
          className={css`
            ${courseMaterialCenteredComponentStyles}
            white-space: pre-line;
            min-width: 1px;
            color: ${textColor};
            background-color: ${backgroundColor};
            font-size: ${fontSize};
            ${backgroundColor && `padding: 1.25em 2.375em;`}
          `}
        >
          {spans}
        </p>
      )
    }
  }

  const sanitizedHTML = sanitizeHtml(content)
  const { count, converted } = convertToLatex(sanitizedHTML)
  const P = count > 0 ? LatexParagraph : Paragraph

  return (
    <P
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${dropCap ? hasDropCap : null}
        white-space: pre-line;
        min-width: 1px;
        color: ${colorMapper(textColor, "#000000")};
        background-color: ${bgColor};
        font-size: ${fontSizeMapper(fontSize)};
        line-height: 2rem;
        text-align: ${align ?? "left"};
      `}
      dangerouslySetInnerHTML={{
        __html: converted,
      }}
      {...(anchor ? { id: anchor } : {})}
    />
  )
}

export default ParagraphBlock
