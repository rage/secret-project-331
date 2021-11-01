/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

export interface HeroSectionAttributes {
  title: string
  subtitle: string
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
      default: "Hero section title...",
    },
    subtitle: {
      type: "string",
      source: "html",
      selector: "h3",
      default: "Hero section subtitle...",
    },
  },
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
