/* eslint-disable i18next/no-literal-string */
import { BlockDeprecation, createBlock } from "@wordpress/blocks"
import { omit } from "lodash"

import { InfoBoxComponentProps } from "."

interface Deprecated1InfoBoxComponentProps {
  title: string
  bodyText: string
}

export const Deprecated1: BlockDeprecation<Deprecated1InfoBoxComponentProps> = {
  attributes: {
    // @ts-ignore: deprecated
    title: {
      type: "string",
      source: "html",
      selector: "h3",
      default: "",
    },
    bodyText: {
      type: "string",
      source: "html",
      selector: "p",
      default: "Infobox body",
    },
  },
  save() {
    return <></>
  },
  isEligible: (attributes) => attributes.title || attributes.bodyText,
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
      newInnerBlocks.push(
        createBlock("core/paragraph", {
          content: attributes.title,
        }),
      )
    }
    const newAttributes: InfoBoxComponentProps = {
      ...omit(attributes, ["title", "bodyText"]),
      backgroundColor: "#faf5f3",
    }
    return [newAttributes, newInnerBlocks]
  },
}
