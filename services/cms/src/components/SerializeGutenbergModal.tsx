"use client"

import { serialize } from "@wordpress/blocks"
import React, { useState } from "react"

import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import MonacoEditor from "@/shared-module/common/components/monaco/MonacoEditor"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

export interface SerializeGutenbergModalProps {
  content: BlockInstance[]
}

const SerializeGutenbergModal: React.FC<React.PropsWithChildren<SerializeGutenbergModalProps>> = ({
  content,
}) => {
  const { t } = useTranslation()
  const [serialized, setSerialized] = useState<string | null>(null)

  return (
    <div>
      <Button size="medium" variant="primary" onClick={() => setSerialized(serialize(content))}>
        {t("serialize-to-html")}
      </Button>
      {}
      <Dialog open={serialized !== null} onClose={() => setSerialized(null)}>
        <MonacoEditor
          height="90vh"
          width="80vw"
          defaultLanguage="html"
          {...(serialized !== null ? { defaultValue: serialized } : {})}
        />
      </Dialog>
    </div>
  )
}

export default SerializeGutenbergModal
