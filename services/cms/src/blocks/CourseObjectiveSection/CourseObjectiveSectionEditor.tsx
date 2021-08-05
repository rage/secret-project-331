import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/heading", "core/buttons", "core/button", "core/paragraph"]
const COURSE_OBJECTIVE_SECTION_TEMPLATE: Template[] = [
  ["core/heading", { content: "In this course you'll...", level: 2, textAlign: "center" }],
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

const CourseObjectiveSectionEditor: React.FC<BlockEditProps<Record<string, never>>> = ({
  clientId,
}) => {
  return (
    <BlockWrapper id={clientId}>
      <div className={"course-objective-wrapper"}>
        <InnerBlocks
          template={COURSE_OBJECTIVE_SECTION_TEMPLATE}
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
        />
      </div>
    </BlockWrapper>
  )
}

export default CourseObjectiveSectionEditor
