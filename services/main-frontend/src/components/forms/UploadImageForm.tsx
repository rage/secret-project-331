import styled from "@emotion/styled"
import React, { createRef, useState } from "react"

import Button from "../../shared-module/components/Button"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface UploadImageFormProps {
  onSubmit: (data: File) => Promise<void>
}

const UploadImageForm: React.FC<UploadImageFormProps> = ({ onSubmit }) => {
  const fileInput = createRef<HTMLInputElement>()
  const [allowSubmit, setAllowSubmit] = useState(true)

  const uploadImage = () => {
    const file = fileInput.current?.files?.[0]
    if (file) {
      setAllowSubmit(false)
      onSubmit(file).finally(() => setAllowSubmit(true))
    }
  }

  return (
    <div>
      <FieldContainer>
        <input accept="image" ref={fileInput} type="file" />
      </FieldContainer>
      <div>
        <Button size="medium" variant="primary" onClick={uploadImage} disabled={!allowSubmit}>
          Upload image
        </Button>
      </div>
    </div>
  )
}

export default UploadImageForm
