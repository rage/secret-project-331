"use client"

/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import AsideWithImageEditor from "./AsideWithImageEditor"
import AsideWithImageSave from "./AsideWithImageSave"

export interface AsideWithImageBlockAttributes {
  title: string
  content: string
}

const AsideWithImageConfiguration: BlockConfiguration<AsideWithImageBlockAttributes> = {
  apiVersion: 3,
  title: "Aside with Image",
  description: "An aside block with custom image",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      isRichText: true,
      default: "This is the heading of this component...",
    },
    content: {
      type: "string",
      isRichText: true,
      default:
        "Coulrophobia brings on feelings of fear when you see clowns or clown images. It's a specific phobic disorder that causes anxiety, a racing heart, nausea and profuse sweating",
    },
  },
  allowedBlocks: ["core/image"],
  edit: AsideWithImageEditor,
  save: AsideWithImageSave,
}

export default AsideWithImageConfiguration
