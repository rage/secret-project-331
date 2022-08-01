import dynamic from "next/dynamic"

export interface MarkDownTextProps {
  text: string
}

// Dynamic import because we want to split commonmark into its own chunk
const MarkdownTextImpl = dynamic(() => import("./MarkdownTextImpl"), { ssr: false })

const MarkdownText: React.FC<React.PropsWithChildren<MarkDownTextProps>> = (props) => (
  <MarkdownTextImpl {...props} />
)

export default MarkdownText
