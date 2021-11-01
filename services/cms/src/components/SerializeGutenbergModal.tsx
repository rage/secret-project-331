import { css } from "@emotion/css"
import { Dialog, Paper } from "@material-ui/core"
import { BlockInstance, serialize } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/components/Button"
import Spinner from "../shared-module/components/Spinner"
import { monospaceFont } from "../shared-module/styles"
import monacoFontFixer from "../shared-module/styles/monacoFontFixer"

export interface SerializeGutenbergModalProps {
  content: BlockInstance[]
}

const MonacoLoading = <Spinner variant="medium" />

const MonacoEditor = dynamic(() => import("react-monaco-editor"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const SerializeGutenbergModal: React.FC<SerializeGutenbergModalProps> = ({ content }) => {
  const { t } = useTranslation()
  const [serialized, setSerialized] = useState<string | null>(null)

  return (
    <div className={monacoFontFixer}>
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
            // eslint-disable-next-line i18next/no-literal-string
            options={{ wordWrap: "on", fontFamily: monospaceFont }}
            height="90vh"
            width="80vw"
            language="html"
            defaultValue={serialized ?? undefined}
          />
        </Paper>
      </Dialog>
    </div>
  )
}

export default SerializeGutenbergModal
