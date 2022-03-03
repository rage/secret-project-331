/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { BlockquoteComponentProps } from "."

const BlockquoteEditor: React.FC<BlockEditProps<BlockquoteComponentProps>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { bodyText } = attributes

  const update = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAttributes({
      cite: event.target.value,
    })
  }
  return (
    <BlockWrapper id={clientId}>
      <p>Blockquote cite</p>
      <textarea
        className={css`
          width: 98%;
          height: 2em;
          margin: 4px;
          resize: none;
        `}
        placeholder="Blockquote cite"
        value={attributes.cite}
        onChange={update}
      />
      <div
        className={css`
          margin-left: 1.5em;
        `}
      >
        <RichText
          className="has-text-align-left wp-block-heading"
          tagName="blockquote"
          value={bodyText}
          onChange={(value: string) => setAttributes({ bodyText: value })}
          placeholder={""}
        />
      </div>
    </BlockWrapper>
  )
}

export default BlockquoteEditor
