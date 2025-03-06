import { css } from "@emotion/css"
import { diffChars } from "diff"
import dynamic from "next/dynamic"
import React, { useContext, useEffect, useMemo, useState } from "react"
import { useMemo as useMemoOne } from "use-memo-one"

import { BlockRendererProps } from "../../.."
import { ParagraphAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../../contexts/GlossaryContext"
import colorMapper from "../../../../../styles/colorMapper"
import { fontSizeMapper, mobileFontSizeMapper } from "../../../../../styles/fontSizeMapper"
import { parseText } from "../../../util/textParsing"

import DiffFormatter from "@/shared-module/common/components/DiffFormatter"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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

interface ExtraAttributes {
  backgroundColor?: string
  textColor?: string
}

const baseParagraphStyles = (hideOverflow = false) => css`
  margin: 1.25rem 0;
  min-width: 1px;
  ${hideOverflow && `overflow-x: hidden; overflow-y: hidden;`}
  height: auto;
`

const UNSET_COLOR = "unset"
const P = "p"

const ParagraphBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ParagraphAttributes & ExtraAttributes>>
> = ({ data, id, editing, selectedBlockId, setEdits }) => {
  const {
    textColor,
    backgroundColor,
    fontSize,
    content,
    dropCap,
    align,
    // className, Additional classNames added in Advanced menu
    // direction, If read from right to left or left to right
    // style,
  } = data.attributes

  const bgColor = useMemo(() => colorMapper(backgroundColor, UNSET_COLOR), [backgroundColor])

  const [editedContent, setEditedContent] = useState(data.attributes.content)
  const { terms } = useContext(GlossaryContext)

  // edited content should not persist between edit proposals
  // reset edited content when no longer editing
  useEffect(() => {
    if (!editing && editedContent !== data.attributes.content) {
      setEditedContent(data.attributes.content)
    }
  }, [data.attributes.content, editedContent, editing])

  const memoizedContent = useMemoOne(() => editedContent, [selectedBlockId])
  const parsedTextResult = useMemo(() => parseText(content, terms), [content, terms])
  const { count, parsedText, hasCitationsOrGlossary } = parsedTextResult
  const ParagraphComponent = useMemo(() => (count > 0 ? LatexParagraph : P), [count])
  const hideOverflow = useMemo(() => !hasCitationsOrGlossary, [hasCitationsOrGlossary])

  const diffChanges = useMemo(() => {
    if (editing && selectedBlockId !== id) {
      return diffChars(data.attributes.content ?? "", editedContent ?? "")
    }
    return null
  }, [editing, selectedBlockId, id, data.attributes.content, editedContent])

  if (editing) {
    if (selectedBlockId === id) {
      return (
        <p
          className={css`
            ${baseParagraphStyles(true)}
            color: ${textColor};
            background-color: ${backgroundColor};
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
                  original_text: content ?? "",
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
      return (
        <p
          className={css`
            ${baseParagraphStyles(true)}
            color: ${textColor};
            background-color: ${backgroundColor};
            font-size: ${fontSizeMapper(fontSize)};
            ${backgroundColor && `padding: 1.25em 2.375em;`}
          `}
        >
          <DiffFormatter changes={diffChanges ?? []} />
        </p>
      )
    }
  }

  return (
    <ParagraphComponent
      className={css`
        ${baseParagraphStyles(hideOverflow)}
        color: ${colorMapper(textColor)};
        background-color: ${bgColor};
        font-size: ${mobileFontSizeMapper(fontSize)};
        line-height: 160%;
        text-align: ${align ?? "left"};
        ${backgroundColor && `padding: 1.25em 2.375em !important;`}

        ${respondToOrLarger.md} {
          font-size: ${fontSizeMapper(fontSize)};
        }

        ${dropCap ? hasDropCap : null}
      `}
      dangerouslySetInnerHTML={{
        __html: parsedText,
      }}
    />
  )
}

const exported = withErrorBoundary(ParagraphBlock)
// @ts-expect-error: Custom property
exported.dontUseDefaultBlockMargin = true

export default exported
