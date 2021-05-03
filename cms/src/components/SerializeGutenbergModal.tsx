import { css } from "@emotion/css"
import { Button, Dialog, Paper } from "@material-ui/core"
import { useState } from "react"
import dynamic from "next/dynamic"
import { BlockInstance, serialize } from "@wordpress/blocks"

export interface SerializeGutenbergModalProps {
  content: BlockInstance[]
}

const MonacoLoading = <div>Loading editor...</div>

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const SerializeGutenbergModal: React.FC<SerializeGutenbergModalProps> = ({ content }) => {
  const [serialized, setSerialized] = useState<string | null>(null)

  return (
    <>
      <Button onClick={() => setSerialized(serialize(content))}>Serialize to HTML</Button>
      <Dialog maxWidth="xl" open={serialized !== null} onClose={() => setSerialized(null)}>
        <Paper
          className={css`
            overflow: hidden;
          `}
        >
          <Editor
            options={{ wordWrap: "on" }}
            height="90vh"
            width="80vw"
            defaultLanguage="html"
            defaultValue={serialized}
          />
        </Paper>
      </Dialog>
    </>
  )
}

export default SerializeGutenbergModal
