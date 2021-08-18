import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"

import { postNewCourse } from "../../services/backend/courses"
import { formatIETFLanguageTagWithRegion } from "../../shared-module/utils/strings"
import { normalizePath } from "../../utils/normalizePath"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  organizationId: string
  onSubmitForm: () => void
}

const NewCourseForm: React.FC<NewCourseFormProps> = ({ organizationId, onSubmitForm }) => {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [locale, setLocale] = useState("en_US")
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createNewCourse = async () => {
    try {
      setSubmitDisabled(true)
      const localeParts = locale.split(/[-_]/)
      const formatedLocale =
        localeParts.length == 2
          ? formatIETFLanguageTagWithRegion(localeParts[0], undefined, localeParts[1], "_")
          : formatIETFLanguageTagWithRegion(localeParts[0], localeParts[1], localeParts[2], "_")
      await postNewCourse({
        name,
        slug,
        organization_id: organizationId,
        locale: formatedLocale,
      })
      onSubmitForm()
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
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
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
