"use client"

/* oxlint-disable i18next/no-literal-string */

import { baseTheme } from "@/shared-module/common/styles"
import { HEX_COLOR_OR_EMPTY } from "@/utils/Gutenberg/agentSchema"
import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import LandingPageHeroSectionEditor from "./TerminologyBlockEditor"
import LandingPageHeroSectionSave from "./TerminologyBlockSave"

export interface TerminologyBlockAttributes {
  title: string
  primaryColor: string
  content: string
  blockName: string
}

const TerminologyBlockConfiguration: BlockConfiguration<TerminologyBlockAttributes> = {
  apiVersion: 3,
  title: "Terminology Block",
  description: "Terminology Block.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      isRichText: true,
      default: "Welcome message for course...",
    },
    blockName: {
      type: "string",
      isRichText: true,
      default: "Terminology",
    },
    primaryColor: {
      type: "string",
      agentSchema: HEX_COLOR_OR_EMPTY,
      default: baseTheme.colors.purple[600],
    },
    content: {
      type: "string",
      default: "Type the block's content here",
    },
  },
  allowedBlocks: ["core/heading", "core/paragraph", "core/list"],
  innerBlocksArea: {
    template: [
      ["core/paragraph", { content: "Insert body text...", placeholder: "Insert body text..." }],
    ],
  },
  edit: LandingPageHeroSectionEditor,
  save: LandingPageHeroSectionSave,
}

export default TerminologyBlockConfiguration
