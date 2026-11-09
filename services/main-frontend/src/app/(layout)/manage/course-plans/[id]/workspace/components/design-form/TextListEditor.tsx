"use client"

import { css } from "@emotion/css"
import { Plus, Trash } from "@vectopus/atlas-icons-react"
import { type Control, type Path, useFieldArray } from "react-hook-form"

import { Button, TextArea } from "@/shared-module/components"

import type { DesignFormValues } from "./designFormDomain"
import { designListRowStyles, designListStyles, ICON_SIZE_BUTTON } from "./designFormStyles"

type TextListPath = "learning_goals" | `chapters.${number}.learning_objectives`

const addButtonRowStyles = css`
  display: flex;
`

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
  const { fields, append, remove } = useFieldArray({ control, name })

  return (
    <div className={designListStyles}>
      {fields.map((field, index) => (
        <div key={field.id} className={designListRowStyles}>
          <TextArea
            name={`${name}.${index}.text` as Path<DesignFormValues>}
            control={control}
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
      <div className={addButtonRowStyles}>
        <Button
          type="button"
          variant="tertiary"
          size="small"
          icon={<Plus size={ICON_SIZE_BUTTON} />}
          onClick={() => append({ text: "" })}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  )
}
