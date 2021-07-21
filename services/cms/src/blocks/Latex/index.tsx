import { BlockConfiguration } from "@wordpress/blocks"

import LatexEditor from "./LatexEditor"
import LatexSave from "./LatexSave"

const LatexBlockConfiguration: BlockConfiguration = {
  title: "Latex Block",
  description: "Block for writing LaTex",
  category: "text",
  attributes: {},
  edit: LatexEditor,
  save: LatexSave,
}

export default LatexBlockConfiguration
