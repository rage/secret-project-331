import { BlockConfiguration } from "@wordpress/blocks"
import PagesInPartEditor from "./PagesInPartEditor"
import PagesInPartSave from "./PagesInPartSave"

export interface PagesInPartAttributes {
  hidden: boolean
}

const PagesInPartConfiguration: BlockConfiguration<PagesInPartAttributes> = {
  title: "Pages In Part",
  description: "Pages In Part",
  category: "embed",
  attributes: {
    hidden: {
      type: "boolean",
      default: false,
    },
  },
  edit: PagesInPartEditor,
  save: PagesInPartSave,
}

export default PagesInPartConfiguration
