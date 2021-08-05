import { BlockConfiguration } from "@wordpress/blocks"

import HeroSectionEditor from "./HeroSectionEditor"
import HeroSectionSave from "./HeroSectionSave"

const HeroSectionConfiguration: BlockConfiguration = {
  title: "Hero Section",
  description:
    "A hero section is a full screen section typically consisting of a background image, or animations, with text and sometimes a call to action.",
  category: "design",
  attributes: {},
  edit: HeroSectionEditor,
  save: HeroSectionSave,
}

export default HeroSectionConfiguration
