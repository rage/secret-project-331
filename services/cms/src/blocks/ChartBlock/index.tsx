"use client"

/* eslint-disable i18next/no-literal-string */
import { image as icon } from "@wordpress/icons"

import ChartBlockEditor from "./ChartBlockEditor"
import ChartBlockSave from "./ChartBlockSave"

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

export interface ChartBlockAttributes {
  spec: string
  caption: string
}

export const DEFAULT_VEGA_LITE_SPEC = JSON.stringify(
  {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    description: "A simple bar chart",
    data: {
      values: [
        { category: "A", value: 28 },
        { category: "B", value: 55 },
        { category: "C", value: 43 },
        { category: "D", value: 91 },
        { category: "E", value: 81 },
        { category: "F", value: 53 },
      ],
    },
    mark: "bar",
    encoding: {
      x: { field: "category", type: "nominal", axis: { labelAngle: 0 } },
      y: { field: "value", type: "quantitative" },
    },
  },
  null,
  2,
)

const ChartBlockConfiguration: BlockConfiguration<ChartBlockAttributes> = {
  title: "ChartBlock",
  description: "Renders a Vega-Lite chart from a JSON specification",
  category: "text",
  attributes: {
    spec: {
      type: "string",
      default: DEFAULT_VEGA_LITE_SPEC,
    },
    caption: {
      type: "string",
      default: "",
    },
  },
  icon,
  edit: ChartBlockEditor,
  save: ChartBlockSave,
}

export default ChartBlockConfiguration
