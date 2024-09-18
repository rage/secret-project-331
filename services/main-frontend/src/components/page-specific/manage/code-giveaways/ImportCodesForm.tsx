import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { addCodesToCodeGiveaway } from "@/services/backend/codeGiveaways"
import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

type ImportCodesFormProps = {
  codeGiveawayId: string
  dialogOpen: boolean
  setDialogOpen: (dialogOpen: boolean) => void
  onCreated?: () => void
}

const ImportCodesForm: React.FC<ImportCodesFormProps> = ({
  codeGiveawayId,
  dialogOpen,
  setDialogOpen,
  onCreated,
}) => {
  const [input, setInput] = useState("")
  const parsedCodes = useMemo(
    () =>
      input
        .trim()
        .split("\n")
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    [input],
  )

  const valid = useMemo(() => parsedCodes.length > 0, [parsedCodes])
  const { t } = useTranslation()

  const importCodesMutation = useToastMutation(
    () => {
      return addCodesToCodeGiveaway(codeGiveawayId, parsedCodes)
    },
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        setInput("")
        setDialogOpen(false)
        if (onCreated) {
          onCreated()
        }
      },
    },
  )
  if (!dialogOpen) {
    return null
  }
  return (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
      <h1>{t("heading-add-codes")}</h1>
      <TextAreaField
        label={t("label-codes-one-per-line")}
        value={input}
        rows={20}
        onChange={(e) => setInput(e.target.value)}
      />
      <div>
        <Button
          size="medium"
          variant="primary"
          onClick={() => {
            importCodesMutation.mutate()
          }}
          disabled={!valid || importCodesMutation.isPending}
        >
          {t("button-text-create")}
        </Button>
        <Button size="medium" variant="secondary" onClick={() => setDialogOpen(false)}>
          {t("button-text-close")}
        </Button>
      </div>
    </Dialog>
  )
}

export default ImportCodesForm
