/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LandingPageHeroSectionEditor from "./LandingPageHeroSectionEditor"
import LandingPageHeroSectionSave from "./LandingPageHeroSectionSave"

export interface LandingPageHeroSectionAttributes {
  title: string
  backgroundColor: string
  fontColor: string
  backgroundImage: string | undefined
  backgroundRepeatX: boolean | undefined
}

const LandingPageHeroSectionConfiguration: BlockConfiguration<LandingPageHeroSectionAttributes> = {
  title: "Landing Page Hero Section",
  description:
    "Landing page hero section is a full screen section typically consisting of a background image, or animations, with text and sometimes a call to action.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h1",
      default: "Welcome message for course...",
    },
    backgroundColor: {
      type: "string",
      default: "#FFFFFF",
    },
    fontColor: {
      type: "string",
      default: "#000000",
    },
    backgroundImage: {
      type: "string",
      default: undefined,
    },
    backgroundRepeatX: {
      type: "boolean",
      default: false,
    },
  },
  edit: LandingPageHeroSectionEditor,
  save: LandingPageHeroSectionSave,
}

export default LandingPageHeroSectionConfiguration
