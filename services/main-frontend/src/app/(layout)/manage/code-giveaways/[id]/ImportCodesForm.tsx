"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { addCodeGiveawayCodesMutation as addCodeGiveawayCodesMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, Dialog, TextArea } from "@/shared-module/components"

interface ImportCodesFormProps {
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
  const { control, watch, reset } = useForm<{ input: string }>({ defaultValues: { input: "" } })
  const input = watch("input")
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

  const importCodesMutation = useToastMutationOptions(
    addCodeGiveawayCodesMutationOptions(),
    {
      method: "POST",
      notify: true,
    },
    {
      onSuccess: () => {
        reset()
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
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t("heading-add-codes")}>
      <TextArea name="input" control={control} label={t("label-codes-one-per-line")} rows={20} />
      <div>
        <Button
          size="medium"
          variant="primary"
          onClick={() => {
            importCodesMutation.mutate({
              path: {
                id: codeGiveawayId,
              },
              body: parsedCodes,
            })
          }}
          disabled={!valid || importCodesMutation.isPending}
        >
          {t("button-text-create")}
        </Button>
      </div>
    </Dialog>
  )
}

export default ImportCodesForm
