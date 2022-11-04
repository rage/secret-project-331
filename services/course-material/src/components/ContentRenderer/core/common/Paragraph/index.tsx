import { css } from "@emotion/css"
import { diffChars } from "diff"
import dynamic from "next/dynamic"
import React, { useContext, useEffect, useState } from "react"
import { useMemo } from "use-memo-one"

import { BlockRendererProps } from "../../.."
import { ParagraphAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import DiffFormatter from "../../../../../shared-module/components/DiffFormatter"
import withErrorBoundary from "../../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../../styles/colorMapper"
import fontSizeMapper from "../../../../../styles/fontSizeMapper"
import { parseText } from "../../../util/textParsing"

const Paragraph = dynamic(() => import("./BasicParagraph"))
const LatexParagraph = dynamic(() => import("./LatexParagraph"))

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

const ParagraphBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ParagraphAttributes>>
> = ({ data, id, editing, selectedBlockId, setEdits }) => {
  const {
    textColor,
    backgroundColor,
    fontSize,
    content,
    dropCap,
    align,
    anchor,
    fontFamily,
    // className, Additional classNames added in Advanced menu
    // direction, If read from right to left or left to right
    // style,
  } = data.attributes

  // If background color is undefined, it indicates a transparent background
  // and we let the background color property unset in CSS.
  // eslint-disable-next-line i18next/no-literal-string
  const bgColor = colorMapper(backgroundColor, "unset")
  const [editedContent, setEditedContent] = useState(data.attributes.content)
  const { terms } = useContext(GlossaryContext)

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
            ${fontFamily && `font-family: ${fontFamily};`}
            font-size: ${fontSizeMapper(fontSize)};
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
            font-size: ${fontSizeMapper(fontSize)};
            ${backgroundColor && `padding: 1.25em 2.375em;`}
          `}
        >
          <DiffFormatter changes={diffChanges} />
        </p>
      )
    }
  }
  const { count, parsedText } = parseText(content, terms)
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

export default withErrorBoundary(ParagraphBlock)
