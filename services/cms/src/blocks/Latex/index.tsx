import { BlockConfiguration } from "@wordpress/blocks"
import LatexSave from "./LatexSave"
import LatexEditor from "./LatexEditor"

const LatexBlockConfiguration: BlockConfiguration = {
  title: "Latex Block",
  description: "Block for writing LaTex",
  category: "embed",
  attributes: {},
  edit: LatexEditor,
  save: LatexSave,
}

export default LatexBlockConfiguration
