import { InnerBlocks, RichText } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { CourseObjectiveSectionAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/button", "core/paragraph"]
const COURSE_OBJECTIVE_SECTION_TEMPLATE: Template[] = [
  [
    "core/columns",
    { isStackedOnMobile: true },
    [
      [
        "core/column",
        {},
        [
          ["core/heading", { placeholder: "Objective #1", level: 3, textAlign: "center" }],
          ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
        ],
      ],
      [
        "core/column",
        {},
        [
          ["core/heading", { placeholder: "Objective #2", level: 3, textAlign: "center" }],
          ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
        ],
      ],
      [
        "core/column",
        {},
        [
          ["core/heading", { placeholder: "Objective #3", level: 3, textAlign: "center" }],
          ["core/paragraph", { placeholder: "Insert text...", align: "center" }],
        ],
      ],
    ],
  ],
]

const CourseObjectiveSectionEditor: React.FC<BlockEditProps<CourseObjectiveSectionAttributes>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title } = attributes
  return (
    <BlockWrapper id={clientId}>
      <div className={"course-objective-wrapper"}>
        <RichText
          className="has-text-align-center wp-block-heading"
          // eslint-disable-next-line i18next/no-literal-string
          tagName="h2"
          value={title}
          onChange={(value: string) => setAttributes({ title: value })}
          // eslint-disable-next-line i18next/no-literal-string
          placeholder={"In this course you'll..."}
        />
        <InnerBlocks
          template={COURSE_OBJECTIVE_SECTION_TEMPLATE}
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
        />
      </div>
    </BlockWrapper>
  )
}

export default CourseObjectiveSectionEditor
