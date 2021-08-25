import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, FormControlLabel, Radio, RadioGroup, TextField } from "@material-ui/core"
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
  const [showCustomLanguageCode, setShowCustomLanguageCode] = useState(false)
  const [languageCodeValidationError, setLanguageCodeValidationError] = useState<string | null>(
    null,
  )
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

  const handleLanguageSelectionChange = (value: string) => {
    if (value === "other") {
      setShowCustomLanguageCode(true)
    } else {
      setShowCustomLanguageCode(false)
      setLanguageCode(value)
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
        <div>Course language</div>
        <FieldContainer aria-labelledby="Course version selection">
          <RadioGroup
            value={showCustomLanguageCode ? "other" : languageCode}
            onChange={(e) => handleLanguageSelectionChange(e.target.value)}
          >
            <FormControlLabel control={<Radio />} key="en-US" label="English" value="en-US" />
            <FormControlLabel control={<Radio />} key="fi-FI" label="Finnish" value="fi-FI" />
            <FormControlLabel control={<Radio />} key="se-SV" label="Swedish" value="se-SV" />
            <FormControlLabel control={<Radio />} key="other" label="other" value="other" />
          </RadioGroup>
        </FieldContainer>
        {showCustomLanguageCode && (
          <>
            <div>{languageCodeValidationError}</div>
            <FieldContainer>
              <TextField
                required
                fullWidth
                id="outlined-required"
                label="Language code"
                variant="outlined"
                value={languageCode}
                onChange={(e) => {
                  setLanguageCode(e.target.value)
                  try {
                    normalizeIETFLanguageTag(e.target.value)
                    setLanguageCodeValidationError(null)
                  } catch (e) {
                    setLanguageCodeValidationError(
                      "Language tag should follow the format aa-BB or aa-Bbbb-CC",
                    )
                  }
                }}
              />
            </FieldContainer>
          </>
        )}
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
