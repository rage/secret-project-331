"use client"

import { Trash } from "@vectopus/atlas-icons-react"
import { type Control, type Path, useFieldArray } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, TextArea } from "@/shared-module/components"

import AddListItemButton from "./AddListItemButton"
import { DESIGN_FORM_LIMITS, type DesignFormValues, maxLengthRules } from "./designFormDomain"
import { designListRowStyles, designListStyles, ICON_SIZE_BUTTON } from "./designFormStyles"

type TextListPath = "learning_goals" | `chapters.${number}.learning_objectives`

/** Editable list of free-text items (learning goals, learning objectives) with add and remove. */
export default function TextListEditor(props: {
  control: Control<DesignFormValues>
  name: TextListPath
  itemLabel: (position: number) => string
  removeLabel: (position: number) => string
  addLabel: string
  rows?: number
}) {
  const { control, name, itemLabel, removeLabel, addLabel, rows = 2 } = props
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name })

  return (
    <div className={designListStyles}>
      {fields.map((field, index) => (
        <div key={field.id} className={designListRowStyles}>
          <TextArea
            name={`${name}.${index}.text` as Path<DesignFormValues>}
            control={control}
            rules={maxLengthRules(t, DESIGN_FORM_LIMITS.longTextChars)}
            label={itemLabel(index + 1)}
            rows={rows}
            autoResize
          />
          <Button
            type="button"
            variant="icon"
            size="small"
            icon={<Trash size={ICON_SIZE_BUTTON} />}
            aria-label={removeLabel(index + 1)}
            onClick={() => remove(index)}
          />
        </div>
      ))}
      <AddListItemButton
        label={addLabel}
        itemCount={fields.length}
        maxItems={DESIGN_FORM_LIMITS.listItems}
        onAdd={() => append({ text: "" })}
      />
    </div>
  )
}
