import { css } from "@emotion/css"
import { Dialog, Paper } from "@material-ui/core"
import { BlockInstance, serialize } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import { useState } from "react"

import Button from "../shared-module/components/Button"

export interface SerializeGutenbergModalProps {
  content: BlockInstance[]
}

const MonacoLoading = <div>Loading editor...</div>

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const SerializeGutenbergModal: React.FC<SerializeGutenbergModalProps> = ({ content }) => {
  const [serialized, setSerialized] = useState<string | null>(null)

  return (
    <>
      <Button size="medium" variant="primary" onClick={() => setSerialized(serialize(content))}>
        Serialize to HTML
      </Button>
      <Dialog maxWidth="xl" open={serialized !== null} onClose={() => setSerialized(null)}>
        <Paper
          className={css`
            overflow: hidden;
          `}
        >
          <MonacoEditor
            options={{ wordWrap: "on" }}
            height="90vh"
            width="80vw"
            defaultLanguage="html"
            defaultValue={serialized ?? undefined}
          />
        </Paper>
      </Dialog>
    </>
  )
}

export default SerializeGutenbergModal
