import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, Dialog, Paper } from "@material-ui/core"
import dynamic from "next/dynamic"
import { Dispatch, useEffect, useState } from "react"

export interface DebugModalProps {
  data: unknown
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

const DebugModal: React.FC<DebugModalProps> = ({ data, readOnly = true, updateDataOnClose }) => {
  const [open, setOpen] = useState(false)
  const [editedContent, setEditedContent] = useState(JSON.stringify(data, undefined, 2))

  useEffect(() => {
    setEditedContent(JSON.stringify(data, undefined, 2))
  }, [data])

  if (!data) {
    return null
  }

  const closeModal = () => {
    setOpen(false)
    if (updateDataOnClose) {
      const parsed = JSON.parse(editedContent)
      updateDataOnClose(parsed)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Debug</Button>
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
