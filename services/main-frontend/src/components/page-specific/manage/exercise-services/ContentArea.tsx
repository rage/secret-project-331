import { css } from "@emotion/css"
// import { TextField } from "@material-ui/core"
import React from "react"

import TextField from "../../../../shared-module/components/InputFields/TextField"

type inputType = "number" | "text"
interface ContentAreaProps {
  title: string
  text: string | number | null
  editing: boolean
  onChange: (value: string) => void
  type: inputType
  error: boolean
}

const ContentArea: React.FC<ContentAreaProps> = ({
  title,
  text,
  error,
  editing,
  onChange,
  type,
}) => {
  return (
    <div
      className={css`
        margin-bottom: 12px;
      `}
    >
      <strong>{title}:</strong>
      <br />

      {editing && type == "text" && (
        <TextField
          label=""
          error={error}
          onChange={(value) => onChange(value)}
          // fullWidth
          value={String(text)}
          placeholder={`${title}...`}
        />
      )}
      {editing && type == "number" && (
        <TextField
          label=""
          error={error}
          onChange={(value) => onChange(value)}
          type={"number"}
          // InputProps={{
          //   inputProps: { min: 1 },
          // }}
          // fullWidth
          value={String(text)}
          placeholder={`${title}...`}
        />
      )}
      {!editing && <span> {text} </span>}
    </div>
  )
}

export default ContentArea
