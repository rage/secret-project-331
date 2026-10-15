import React from "react"

import dynamicImport from "@/shared-module/common/utils/dynamicImport"

export interface MarkDownTextProps {
  text: string
}

// Dynamic import because we want to split commonmark into its own chunk
const MarkdownTextImpl = dynamicImport<MarkDownTextProps>(() => import("./MarkdownTextImpl"))

const MarkdownText: React.FC<React.PropsWithChildren<MarkDownTextProps>> = (props) => (
  <MarkdownTextImpl {...props} />
)

export default MarkdownText
