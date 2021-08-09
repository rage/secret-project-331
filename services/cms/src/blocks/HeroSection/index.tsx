import { BlockConfiguration } from "@wordpress/blocks"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

const HeroSectionConfiguration: BlockConfiguration<Record<string, never>> = {
  title: "Hero Section",
  description: "A hero section for chapter front page with a heading and subheading.",
  category: "design",
  attributes: {},
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
