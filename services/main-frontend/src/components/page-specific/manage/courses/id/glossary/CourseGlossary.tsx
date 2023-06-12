import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchGlossary, postNewTerm } from "../../../../../../services/backend/courses"
import { deleteTerm, updateTerm } from "../../../../../../services/backend/glossary"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import TextAreaField from "../../../../../../shared-module/components/InputFields/TextAreaField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../../../shared-module/components/Spinner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"

const CourseGlossary: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  const [newTerm, setNewTerm] = useState("")
  const [newDefinition, setNewDefinition] = useState("")
  const [updatedTerm, setUpdatedTerm] = useState("")
  const [updatedDefinition, setUpdatedDefinition] = useState("")
  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const glossary = useQuery([`glossary-${courseId}`], () => fetchGlossary(courseId))
  const createMutation = useToastMutation(
    () => postNewTerm(courseId, newTerm, newDefinition),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        setNewTerm("")
        setNewDefinition("")
        glossary.refetch()
      },
    },
  )
  const updateMutation = useToastMutation(
    (termId: string) => updateTerm(termId, updatedTerm, updatedDefinition),
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: () => {
        setEditingTerm(null)
        glossary.refetch()
      },
    },
  )
  const deleteMutation = useToastMutation(
    (termId: string) => deleteTerm(termId),
    {
      notify: true,
      method: "DELETE",
    },
    { onSuccess: () => glossary.refetch() },
  )

  return (
    <>
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("manage-glossary")}
      </h1>
      {glossary.isError && <ErrorBanner variant={"readOnly"} error={glossary.error} />}
      {glossary.isLoading && <Spinner variant={"medium"} />}
      <div>
        <TextField
          label={t("new-term")}
          placeholder={t("new-term")}
          value={newTerm}
          onChangeByValue={setNewTerm}
        />
        <TextAreaField
          name={t("new-definition")}
          placeholder={t("new-definition")}
          label={t("new-definition")}
          value={newDefinition}
          onChangeByValue={setNewDefinition}
          disabled={false}
        />
        <Button variant="primary" size="medium" onClick={() => createMutation.mutate()}>
          {t("button-text-save")}
        </Button>
      </div>
      {glossary.isSuccess &&
        glossary.data
          .sort((a, b) => a.term.localeCompare(b.term))
          .map((term) => {
            return editingTerm === term.id ? (
              <div key={term.id}>
                <hr />
                <TextField
                  placeholder={t("updated-term")}
                  label={t("updated-term")}
                  value={updatedTerm}
                  onChangeByValue={setUpdatedTerm}
                />
                <TextAreaField
                  name={t("updated-definition")}
                  label={t("updated-definition")}
                  placeholder={t("updated-definition")}
                  value={updatedDefinition}
                  onChangeByValue={setUpdatedDefinition}
                  disabled={false}
                />
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => updateMutation.mutate(term.id)}
                >
                  {t("button-text-save")}
                </Button>
                <Button variant="tertiary" size="medium" onClick={() => setEditingTerm(null)}>
                  {t("button-text-cancel")}
                </Button>
              </div>
            ) : (
              <div key={term.id}>
                <hr />
                <div>{term.term}</div>
                <div>{term.definition}</div>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => {
                    setUpdatedTerm(term.term)
                    setUpdatedDefinition(term.definition)
                    setEditingTerm(term.id)
                  }}
                >
                  {t("edit")}
                </Button>
                <Button
                  variant="tertiary"
                  size="medium"
                  onClick={() => deleteMutation.mutate(term.id)}
                >
                  {t("button-text-delete")}
                </Button>
              </div>
            )
          })}
    </>
  )
}

export default CourseGlossary
