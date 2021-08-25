import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"

import { NewCourse } from "../../shared-module/bindings"
import { normalizeIETFLanguageTag } from "../../shared-module/utils/strings"
import { normalizePath } from "../../utils/normalizePath"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  organizationId: string
  onSubmitForm: (newCourse: NewCourse) => Promise<void>
}

const NewCourseForm: React.FC<NewCourseFormProps> = ({ organizationId, onSubmitForm }) => {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [languageCode, setLanguageCode] = useState("en-US")
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createNewCourse = async () => {
    try {
      setSubmitDisabled(true)
      const normalizedLanguageCode = normalizeIETFLanguageTag(languageCode)
      await onSubmitForm({
        name,
        slug,
        organization_id: organizationId,
        language_code: normalizedLanguageCode,
      })
      setName("")
      setSlug("")
      setLanguageCode("en-US")
      setError(null)
    } catch (e) {
      setError(e.toString())
    } finally {
      setSubmitDisabled(false)
    }
  }

  return (
    <div
      className={css`
        width: 500px;
        padding: 1rem 0;
      `}
    >
      <div>
        {error && <pre>{error}</pre>}
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="outlined-required"
            label="Course name"
            variant="outlined"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSlug(normalizePath(e.target.value))
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="outlined-required"
            label="Slug"
            variant="outlined"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            fullWidth
            id="outlined-required"
            label="Language code"
            variant="outlined"
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
          />
        </FieldContainer>
      </div>
      <div>
        <Button disabled={submitDisabled} onClick={createNewCourse}>
          Create course
        </Button>
      </div>
    </div>
  )
}

export default NewCourseForm
