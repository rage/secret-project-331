import { BlockInstance, serialize } from "@wordpress/blocks"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import MonacoEditor from "@/shared-module/common/components/monaco/MonacoEditor"

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
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Dialog open={serialized !== null} onClose={() => setSerialized(null)}>
        <MonacoEditor
          height="90vh"
          width="80vw"
          defaultLanguage="html"
          defaultValue={serialized ?? undefined}
        />
      </Dialog>
    </div>
  )
}

export default SerializeGutenbergModal
