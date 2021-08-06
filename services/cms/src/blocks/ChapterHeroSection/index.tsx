import { BlockConfiguration } from "@wordpress/blocks"

import ChapterHeroSectionEditor from "./ChapterHeroSectionEditor"
import ChapterHeroSectionSave from "./ChapterHeroSectionSave"

const ChapterHeroSectionConfiguration: BlockConfiguration<Record<string, never>> = {
  title: "Chapter Hero Section",
  description: "A hero section for chapter front page with a heading and subheading.",
  category: "design",
  attributes: {},
  edit: ChapterHeroSectionEditor,
  save: ChapterHeroSectionSave,
}

export default ChapterHeroSectionConfiguration
