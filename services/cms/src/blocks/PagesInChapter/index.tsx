import { BlockConfiguration } from "@wordpress/blocks"
import PagesInChapterEditor from "./PagesInChapterEditor"
import PagesInChapterSave from "./PagesInChaptertSave"

const PagesInChapterConfiguration: BlockConfiguration = {
  title: "Pages In Chapter",
  description: "Pages In Chapter",
  category: "embed",
  attributes: {},
  edit: PagesInChapterEditor,
  save: PagesInChapterSave,
}

export default PagesInChapterConfiguration
