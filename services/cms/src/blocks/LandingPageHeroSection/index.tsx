/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import LandingPageHeroSectionEditor from "./LandingPageHeroSectionEditor"
import LandingPageHeroSectionSave from "./LandingPageHeroSectionSave"

export interface LandingPageHeroSectionAttributes {
  title: string
  backgroundColor: string
  backgroundImage: string | undefined
}

const LandingPageHeroSectionConfiguration: BlockConfiguration<LandingPageHeroSectionAttributes> = {
  title: "Landing Page Hero Section",
  description:
    "Landing page hero section is a full screen section typically consisting of a background image, or animations, with text and sometimes a call to action.",
  category: "design",
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
    backgroundImage: {
      type: "string",
      default: undefined,
    },
  },
  edit: LandingPageHeroSectionEditor,
  save: LandingPageHeroSectionSave,
}

export default LandingPageHeroSectionConfiguration
