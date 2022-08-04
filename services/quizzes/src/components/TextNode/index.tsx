import dynamic from "next/dynamic"
import React from "react"

export interface TextNodeProps {
  text: string
}

const TextNodeImpl = dynamic(() => import("./TextNodeImpl"), { ssr: false })

const TextNode: React.FC<React.PropsWithChildren<TextNodeProps>> = (props) => (
  <TextNodeImpl {...props} />
)

export default TextNode
