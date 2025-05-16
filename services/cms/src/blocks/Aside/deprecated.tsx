/* eslint-disable i18next/no-literal-string */
import { BlockDeprecation, createBlock } from "@wordpress/blocks"
import { omit } from "lodash"

import { AsideComponentProps } from "."

interface Deprecated1AsideComponentProps {
  title: string
  bodyText: string
}

export const Deprecated1: BlockDeprecation<Deprecated1AsideComponentProps> = {
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h2",
      default: "",
    },
    bodyText: {
      type: "string",
      source: "html",
      selector: "p",
      default: "Aside body",
    },
  },
  save() {
    return <></>
  },
  isEligible: (attributes) => attributes.title || attributes.bodyText,
  // @ts-expect-error: wat
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
    const newAttributes: AsideComponentProps = {
      ...omit(attributes, ["title", "bodyText"]),
      backgroundColor: "#ebf5fb",
      separatorColor: "#007acc",
    }
    return [newAttributes, newInnerBlocks]
  },
}
