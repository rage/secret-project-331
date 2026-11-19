"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CounterpartLinkChange, SuggestionReason } from "@/generated/api/types.generated"
import type { usePageLinksMutation } from "@/hooks/useLanguageVersions"
import { Badge, Dialog, Radio, RadioGroup, TONE } from "@/shared-module/components"

import { UNLINK } from "../constants"
import { cancelAction, dialogBodyCss, hintCss, suggestionReasonText } from "../shared"

interface Props {
  /** Items of one course that are all linked to the same counterparts. */
  items: { id: string; label: string }[]
  /** Language of the items, named in the title. */
  language: string
  /** The counterpart they all are linked to, named in the title. */
  linkedTitle: string
  suggestedId: string | null
  suggestionReason: SuggestionReason | null
  lead: string
  hint: string
  /** Saves the unlinks: page or exercise links, matching `items`. */
  linkMutation: ReturnType<typeof usePageLinksMutation>
  courseId: string
  onClose: () => void
}

interface Fields {
  keptId: string
}

/**
 * Several pages (or exercises) of one course are linked to the same counterparts: keeps one
 * linked and unlinks the others, which stay in the course unchanged.
 */
const KeepOneLinkedDialog: React.FC<Props> = ({
  items,
  language,
  linkedTitle,
  suggestedId,
  suggestionReason,
  lead,
  hint,
  linkMutation,
  courseId,
  onClose,
}) => {
  const { t } = useTranslation()
  const { control, watch } = useForm<Fields>({
    defaultValues: { keptId: suggestedId ?? items[0]?.id ?? "" },
  })
  const keptId = watch("keptId")

  const confirm = () => {
    linkMutation.mutate(
      {
        path: { course_id: courseId },
        body: {
          changes: items
            .filter((item) => item.id !== keptId)
            .map((item): CounterpartLinkChange => ({ action: UNLINK, id: item.id })),
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("language-versions-keep-one-title", { language, title: linkedTitle })}
      actions={[
        cancelAction(t, onClose),
        {
          label: t("language-versions-keep-this-link"),
          variant: "primary",
          disabled: keptId === "",
          isLoading: linkMutation.isPending,
          onPress: confirm,
        },
      ]}
    >
      <div className={dialogBodyCss}>
        <RadioGroup name="keptId" control={control} label={lead} proseDescription>
          {items.map((item) => (
            <Radio
              key={item.id}
              value={item.id}
              label={item.label}
              badge={
                item.id === suggestedId ? (
                  <Badge size="compact" tone={TONE.INFO}>
                    {t("language-versions-suggested")}
                  </Badge>
                ) : undefined
              }
              description={
                item.id === suggestedId && suggestionReason
                  ? suggestionReasonText(t, suggestionReason)
                  : undefined
              }
            />
          ))}
        </RadioGroup>
        <p className={hintCss}>{hint}</p>
      </div>
    </Dialog>
  )
}

export default KeepOneLinkedDialog
