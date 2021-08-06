import { BlockConfiguration } from "@wordpress/blocks"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

export interface HeroSectionAttributes {
  heroHeading: string
}

const HeroSectionConfiguration: BlockConfiguration<HeroSectionAttributes> = {
  title: "Hero Section",
  description:
    "A hero section is a full screen section typically consisting of a background image, or animations, with text and sometimes a call to action.",
  category: "design",
  attributes: {
    heroHeading: {
      type: "string",
      source: "html",
      selector: "h1",
    },
  },
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
