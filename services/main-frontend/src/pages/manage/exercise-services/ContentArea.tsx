import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import React from "react"

type inputType = "number" | "text"
interface ContentAreaProps {
  title: string
  text: string | number | null
  editing: boolean
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
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
          error={error}
          onChange={onChange}
          fullWidth
          value={text}
          placeholder={`${title}...`}
        />
      )}
      {editing && type == "number" && (
        <TextField
          error={error}
          onChange={onChange}
          type={"number"}
          InputProps={{
            inputProps: { min: 1 },
          }}
          fullWidth
          value={text}
          placeholder={`${title}...`}
        />
      )}
      {!editing && <span> {text} </span>}
    </div>
  )
}

export default ContentArea
