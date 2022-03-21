/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import AsideEditor from "./AsideEditor"
import AsideSave from "./AsideSave"

export interface AsideComponentProps {
  title: string
  bodyText: string
}

const AsideConfiguration: BlockConfiguration<AsideComponentProps> = {
  title: "Aside",
  description: "Aside with body text and possible heading",
  category: "design",
  attributes: {
    title: {
      type: "string",
      source: "html",
      selector: "h2",
      default: "",
    },
    bodyText: {
      type: "string",
      source: "html",
      selector: "p",
      default: "Aside body",
    },
  },
  edit: AsideEditor,
  save: AsideSave,
}

export default AsideConfiguration
