/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

export interface HeroSectionAttributes {
  title: string
  subtitle: string
  backgroundColor: string | undefined
  fontColor: string | undefined
  backgroundImage: string | undefined
  backgroundRepeatX: boolean | undefined
}

const HeroSectionConfiguration: BlockConfiguration<HeroSectionAttributes> = {
  title: "Hero Section",
  description: "A hero section for chapter front page with a heading and subheading.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    chapter: {
      type: "string",
      source: "html",
      selector: "h6",
      default: "Chapter number...",
    },
    title: {
      type: "string",
      source: "html",
      selector: "h2",
      default: "Hero section title...",
    },
    subtitle: {
      type: "string",
      source: "html",
      selector: "h3",
      default: "Hero section subtitle...",
    },
    backgroundColor: {
      type: "string",
      default: "#f9f9f9",
    },
    fontColor: {
      type: "string",
      default: "#f9f9f9",
    },
    backgroundImage: {
      type: "string",
      default: undefined,
    },
    backgroundRepeatX: {
      type: "boolean",
      default: false,
    },
    alignCenter: {
      type: "boolean",
      default: false,
    },
  },
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
