import { BlockConfiguration } from "@wordpress/blocks"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

export interface HeroSectionAttributes {
  title: string
  subTitle: string
}

const HeroSectionConfiguration: BlockConfiguration<HeroSectionAttributes> = {
  title: "Hero Section",
  description: "A hero section for chapter front page with a heading and subheading.",
  category: "design",
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h2",
    },
    subTitle: {
      type: "string",
      source: "html",
      selector: "h3",
    },
  },
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
