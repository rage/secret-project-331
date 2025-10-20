import React, { useMemo } from "react"

import { FloatingHeaderTable } from "../FloatingHeaderTable"
import { completionsColumns, completionsData } from "../studentsTableData"
import { COMPLETIONS_LEAF_MIN_WIDTH, COMPLETIONS_LEAF_WIDTH, PAD } from "../studentsTableStyles"

export const CompletionsTabContent: React.FC = () => {
  // This code segment will be reworked later with actual backend data
  const sizedCompletionsColumns = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return completionsColumns.map((group: any, groupIdx: number) => {
      if (group.header === "Student") {
        return group
      }

      const colorPairIndex = groupIdx - 1
      return {
        ...group,
        meta: { ...(group.meta ?? {}), colorPairIndex },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        columns: group.columns.map((leaf: any, leafIdx: number) => ({
          ...leaf,
          meta: {
            ...(leaf.meta ?? {}),
            width: COMPLETIONS_LEAF_WIDTH,
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: leafIdx % 2,
            padLeft: PAD,
            padRight: PAD,
          },
        })),
      }
    })
  }, [])

  return (
    <FloatingHeaderTable
      columns={sizedCompletionsColumns}
      data={completionsData}
      colorHeaders
      colorColumns
      colorHeaderUnderline
    />
  )
}
