import React, { useState } from "react"

import TextField from "@/shared-module/common/components/InputFields/TextField"

interface NumericFieldProps {
  value: number
  label: string
  onCommit: (value: number) => void
}

/**
 * Number input backed by local text state, so intermediate entries ("1.", "-", "") are not snapped
 * by a String()/Number() round-trip mid-keystroke. Only parseable values reach the spec, and the
 * field normalizes back to the committed value on blur.
 */
const NumericField: React.FC<NumericFieldProps> = ({ value, label, onCommit }) => {
  const [text, setText] = useState(String(value))
  return (
    <TextField
      value={text}
      label={label}
      name={label}
      onChangeByValue={(next) => {
        setText(next)
        const parsed = Number(next.trim().replace(",", "."))
        if (next.trim() !== "" && Number.isFinite(parsed)) {
          onCommit(parsed)
        }
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

export default NumericField
