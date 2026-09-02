"use client"

import { serialize } from "@wordpress/blocks"
import React, { useState } from "react"

import MonacoEditor from "@/shared-module/common/components/monaco/MonacoEditor"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Button, Dialog } from "@/shared-module/components"
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
      <Dialog
        open={serialized !== null}
        onClose={() => setSerialized(null)}
        aria-label={t("serialize-to-html")}
      >
        <MonacoEditor
          height="90vh"
          width="80vw"
          defaultLanguage="html"
          {...includeIf(serialized !== null, { defaultValue: serialized })}
        />
      </Dialog>
    </div>
  )
}

export default SerializeGutenbergModal
