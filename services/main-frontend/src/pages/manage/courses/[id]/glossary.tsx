import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { fetchGlossary, postNewTerm } from "../../../../services/backend/courses"
import { deleteTerm, updateTerm } from "../../../../services/backend/glossary"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import TextAreaField from "../../../../shared-module/components/InputFields/TextAreaField"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface Props {
  query: SimplifiedUrlQuery<"id">
}

const ManageGlossary: React.FC<Props> = ({ query }) => {
  const { t } = useTranslation()
  const courseId = query.id

  const [newTerm, setNewTerm] = useState("")
  const [newDefinition, setNewDefinition] = useState("")
  const [updatedTerm, setUpdatedTerm] = useState("")
  const [updatedDefinition, setUpdatedDefinition] = useState("")
  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const glossary = useQuery(`glossary-${courseId}`, () => fetchGlossary(courseId))
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

  if (glossary.isIdle || glossary.isLoading) {
    return <Spinner variant={"small"} />
  }

  if (glossary.isError) {
    return <ErrorBanner variant={"readOnly"} error={glossary.error} />
  }

  return (
    <Layout navVariant={"complex"}>
      <>
        <h1>{t("manage-glossary")}</h1>
        <div>
          <TextField
            label={t("new-term")}
            placeholder={t("new-term")}
            value={newTerm}
            onChange={setNewTerm}
          />
          <TextAreaField
            name={t("new-definition")}
            placeholder={t("new-definition")}
            label={t("new-definition")}
            value={newDefinition}
            onChange={setNewDefinition}
            disabled={false}
          />
          <Button variant="primary" size="medium" onClick={() => createMutation.mutate()}>
            {t("button-text-save")}
          </Button>
        </div>
        {glossary.data
          .sort((a, b) => a.term.localeCompare(b.term))
          .map((term) => {
            return editingTerm === term.id ? (
              <div key={term.id}>
                <hr />
                <TextField
                  placeholder={t("updated-term")}
                  label={t("updated-term")}
                  value={updatedTerm}
                  onChange={setUpdatedTerm}
                />
                <TextAreaField
                  name={t("updated-definition")}
                  label={t("updated-definition")}
                  placeholder={t("updated-definition")}
                  value={updatedDefinition}
                  onChange={setUpdatedDefinition}
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
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(ManageGlossary)))
