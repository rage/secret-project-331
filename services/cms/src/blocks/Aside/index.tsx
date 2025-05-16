/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import AsideEditor from "./AsideEditor"
import AsideSave from "./AsideSave"
import { Deprecated1 } from "./deprecated"

export interface AsideComponentProps {
  backgroundColor: string
  separatorColor: string
}

const AsideConfiguration: BlockConfiguration<AsideComponentProps> = {
  title: "Aside",
  description: "Aside with body text and possible heading",
  category: "design",
  attributes: {
    backgroundColor: {
      type: "string",
      default: "#ebf5fb",
    },
    separatorColor: {
      type: "string",
      default: "#007acc",
    },
  },
  edit: AsideEditor,
  save: AsideSave,
  // @ts-expect-error: Wrong type, the deprecations have a different interface for the previous attributes
  deprecated: [Deprecated1],
}

export default AsideConfiguration
