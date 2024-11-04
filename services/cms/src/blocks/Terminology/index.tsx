/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LandingPageHeroSectionEditor from "./TerminologyBlockEditor"
import LandingPageHeroSectionSave from "./TerminologyBlockSave"

import { baseTheme } from "@/shared-module/common/styles"

export interface TerminologyBlockAttributes {
  title: string
  primaryColor: string
  content: string
  blockName: string
}

const LandingPageHeroSectionConfiguration: BlockConfiguration<TerminologyBlockAttributes> = {
  title: "Terminology Block",
  description: "Terminology Block.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h1",
      default: "Welcome message for course...",
    },
    blockName: {
      type: "string",
      default: "Terminology",
    },
    primaryColor: {
      type: "string",
      default: baseTheme.colors.purple[600],
    },
    content: {
      type: "string",
      default: "Type the block's content here",
    },
  },
  edit: LandingPageHeroSectionEditor,
  save: LandingPageHeroSectionSave,
}

export default LandingPageHeroSectionConfiguration
