import React, { useEffect, useRef, useState } from "react"

import TextField from "@/shared-module/common/components/InputFields/TextField"
import { stringToNumberOrNull } from "@/shared-module/components/lib/utils/rhfAdapters"

// Rejects forms Number() would also accept, like "0x10" or "1e3".
const WHOLE_NUMBER = /^\s*-?\d+\s*$/

interface NumericFieldProps {
  value: number
  label: string
  onCommit: (value: number) => void
  /** Values below this are clamped up before reaching the spec, e.g. a tolerance that must stay >= 0. */
  min?: number
  /** Only whole numbers are committed. */
  integer?: boolean
}

/** Keeps partial input like "1." or "-" as text; only parseable values are committed, and blur resets to the committed value. */
const NumericField: React.FC<NumericFieldProps> = ({ value, label, onCommit, min, integer }) => {
  const [text, setText] = useState(String(value))
  const isFocused = useRef(false)

  useEffect(() => {
    if (!isFocused.current) {
      setText(String(value))
    }
  }, [value])

  return (
    <TextField
      value={text}
      label={label}
      name={label}
      onChangeByValue={(next) => {
        setText(next)
        const parsed = stringToNumberOrNull(next)
        if (parsed !== null && (!integer || WHOLE_NUMBER.test(next))) {
          onCommit(min === undefined ? parsed : Math.max(min, parsed))
        }
      }}
      onFocus={() => {
        isFocused.current = true
      }}
      onBlur={() => {
        isFocused.current = false
        setText(String(value))
      }}
    />
  )
}

export default NumericField
