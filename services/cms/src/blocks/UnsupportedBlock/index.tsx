import { BlockConfiguration } from "@wordpress/blocks"

import UnsupportedEditor from "./UnsupportedEditor"
import UnsupportedSave from "./UnsupportedSave"

const UnsupportedConfiguration: BlockConfiguration = {
  title: "Unsupported block",
  description: "Unsupported component block.",
  category: "design",
  attributes: {},
  edit: UnsupportedEditor,
  save: UnsupportedSave,
}

export default UnsupportedConfiguration
