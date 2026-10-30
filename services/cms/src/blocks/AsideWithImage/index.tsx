"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import AsideWithImageEditor from "./AsideWithImageEditor"
import AsideWithImageSave from "./AsideWithImageSave"
import { ASIDE_HEADING_LEVELS, DEFAULT_ASIDE_HEADING_LEVEL } from "./headingLevel"

export interface AsideWithImageBlockAttributes {
  title: string
  content: string
  headingLevel?: number
}

const AsideWithImageConfiguration: BlockConfiguration<AsideWithImageBlockAttributes> = {
  apiVersion: 3,
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
    headingLevel: {
      type: "number",
      enum: ASIDE_HEADING_LEVELS,
      default: DEFAULT_ASIDE_HEADING_LEVEL,
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
