import { BlockConfiguration } from "@wordpress/blocks"
import PagesInPartEditor from "./PagesInPartEditor"
import PagesInPartSave from "./PagesInPartSave"

const PagesInPartConfiguration: BlockConfiguration = {
  title: "Pages In Part",
  description: "Pages In Part",
  category: "embed",
  attributes: {},
  edit: PagesInPartEditor,
  save: PagesInPartSave,
}

export default PagesInPartConfiguration
