import styled from "@emotion/styled"
import { Button } from "@material-ui/core"
import React, { useState } from "react"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface UploadImageFormProps {
  onSubmit: (data: File) => void
}

const UploadImageForm: React.FC<UploadImageFormProps> = ({ onSubmit }) => {
  const [image, setImage] = useState<File | undefined>()

  const uploadImage = () => {
    setImage(undefined)
    onSubmit(image)
  }

  return (
    <div>
      <FieldContainer>
        <input
          type="file"
          accept="image/jpg, image/png, image/svg"
          onChange={(e) => {
            setImage(e.target.files[0])
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
