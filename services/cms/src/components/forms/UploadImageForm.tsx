import styled from "@emotion/styled"
import { Button, Input } from "@material-ui/core"
import React, { useState } from "react"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface UploadImageFormProps {
  onSubmit: (data: File) => void
}

// DOM types don't account for files-attribute when type="file". Hence this alias.
type TargetWithFiles = (EventTarget & (HTMLInputElement | HTMLTextAreaElement)) & {
  files: ReadonlyArray<File>
}

const UploadImageForm: React.FC<UploadImageFormProps> = ({ onSubmit }) => {
  const [image, setImage] = useState<File | undefined>()

  const uploadImage = () => {
    onSubmit(image)
  }

  return (
    <div>
      <FieldContainer>
        <Input
          type="file"
          // TODO: accept doesn't seem to work
          inputProps={{ accept: "image/jpg, image/png, image/svg" }}
          onChange={(e) => {
            setImage((e.target as TargetWithFiles).files[0])
          }}
        />
      </FieldContainer>
      <div>
        <Button onClick={uploadImage} disabled={!image} variant="outlined">
          Upload image
        </Button>
      </div>
    </div>
  )
}

export default UploadImageForm
