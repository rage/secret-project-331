import { css } from "@emotion/css"
import { Button, Dialog, Paper } from "@material-ui/core"
import { Dispatch, useState } from "react"
import dynamic from "next/dynamic"
import styled from "@emotion/styled"
import { BlockInstance } from "@wordpress/blocks"

export interface DebugModalProps {
  content: BlockInstance[]
  readOnly?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDataOnClose?: Dispatch<any>
}

const MonacoLoading = <div>Loading editor...</div>

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const HeaderBar = styled.div`
  display: flex;
  padding: 0.5rem;
  align-items: center;

  h1 {
    font-size: 1.25rem;
    margin-bottom: 0;
  }
`

const DebugModal: React.FC<DebugModalProps> = ({ content, readOnly = true, updateDataOnClose }) => {
  const [open, setOpen] = useState(false)
  const [editedContent, setEditedContent] = useState<string | null>(null)

  if (!content) {
    return null
  }

  const closeModal = () => {
    setOpen(false)
    if (updateDataOnClose) {
      const parsed = JSON.parse(editedContent)
      updateDataOnClose(parsed)
    }
  }

  const openModal = () => {
    setEditedContent(JSON.stringify(content, undefined, 2))
    setOpen(true)
  }

  return (
    <>
      <Button onClick={() => openModal()}>Debug</Button>
      <Dialog maxWidth="xl" open={open} onClose={closeModal}>
        <Paper
          className={css`
            overflow: hidden;
          `}
        >
          <HeaderBar>
            <h1>Debug view ({readOnly ? "read only" : "editable"})</h1>
            <div
              className={css`
                flex-grow: 1;
              `}
            />
            <Button onClick={closeModal}>Close</Button>
          </HeaderBar>
          <Editor
            height="90vh"
            width="80vw"
            defaultLanguage="json"
            options={{ wordWrap: "on", readOnly }}
            defaultValue={editedContent}
            onChange={(value) => value && setEditedContent(value)}
          />
        </Paper>
      </Dialog>
    </>
  )
}

export default DebugModal
