import { css } from "@emotion/css"
import { Dialog, Paper } from "@material-ui/core"
import { BlockInstance, serialize } from "@wordpress/blocks"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import MonacoEditor from "../shared-module/components/monaco/MonacoEditor"

export interface SerializeGutenbergModalProps {
  content: BlockInstance[]
}

const SerializeGutenbergModal: React.FC<SerializeGutenbergModalProps> = ({ content }) => {
  const { t } = useTranslation()
  const [serialized, setSerialized] = useState<string | null>(null)

  return (
    <div>
      <Button size="medium" variant="primary" onClick={() => setSerialized(serialize(content))}>
        {t("serialize-to-html")}
      </Button>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Dialog maxWidth="xl" open={serialized !== null} onClose={() => setSerialized(null)}>
        <Paper
          className={css`
            overflow: hidden;
          `}
        >
          <MonacoEditor
            height="90vh"
            width="80vw"
            defaultLanguage="html"
            defaultValue={serialized ?? undefined}
          />
        </Paper>
      </Dialog>
    </div>
  )
}

export default SerializeGutenbergModal
