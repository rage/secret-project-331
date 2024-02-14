/* eslint-disable i18next/no-literal-string */
import { useBlockProps } from "@wordpress/block-editor"
import { BlockDeprecation, createBlock } from "@wordpress/blocks"
import { omit } from "lodash"

import { InfoBoxComponentProps } from "."

interface Deprecated1InfoBoxComponentProps {
  title: string
  bodyText: string
}

export const Deprecated1: BlockDeprecation<Deprecated1InfoBoxComponentProps> = {
  attributes: {
    title: {
      type: "string",
      default: "",
    },
    bodyText: {
      type: "string",
      default: "Infobox body",
    },
  },
  save(props) {
    const blockProps = useBlockProps.save()
    return (
      <div {...blockProps}>
        {props.attributes.title}
        {props.attributes.bodyText}
      </div>
    )
  },
  isEligible: (attributes) => {
    return Boolean(attributes.title || attributes.bodyText)
  },
  // @ts-ignore: wat
  migrate: (attributes, innerBlocks) => {
    const newInnerBlocks = [...innerBlocks]
    if (attributes.title && attributes.title.trim() !== "") {
      newInnerBlocks.unshift(
        createBlock("core/heading", {
          content: attributes.title,
          level: 3,
        }),
      )
    }
    if (attributes.bodyText && attributes.bodyText.trim() !== "") {
      const bodyText: string = attributes.bodyText
      bodyText.split("<br>").forEach((paragraph) => {
        const trimmed = paragraph.trim()
        if (trimmed === "") {
          return
        }
        newInnerBlocks.push(
          createBlock("core/paragraph", {
            content: trimmed,
          }),
        )
      })
    }
    const newAttributes: InfoBoxComponentProps = {
      ...omit(attributes, ["title", "bodyText"]),
      backgroundColor: "#faf5f3",
      noPadding: false,
    }
    return [newAttributes, newInnerBlocks]
  },
}
