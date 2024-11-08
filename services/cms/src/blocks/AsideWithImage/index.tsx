/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import AsideWithImageEditor from "./AsideWithImageEditor"
import AsideWithImageSave from "./AsideWithImageSave"

export interface AsideWithImageBlockAttributes {
  title: string
  content: string
}

const AsideWithImageConfiguration: BlockConfiguration<AsideWithImageBlockAttributes> = {
  title: "Aside with Image",
  description: "An aside block with custom image",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h1",
      default: "This is the heading of this component...",
    },
    content: {
      type: "string",
      default:
        "Coulrophobia brings on feelings of fear when you see clowns or clown images. It's a specific phobic disorder that causes anxiety, a racing heart, nausea and profuse sweating",
    },
  },
  edit: AsideWithImageEditor,
  save: AsideWithImageSave,
}

export default AsideWithImageConfiguration
