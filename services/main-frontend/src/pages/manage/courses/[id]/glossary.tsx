/* eslint-disable i18next/no-literal-string */

import React, { useState } from "react"
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
        <h1>Manage glossary</h1>
        <div>
          <TextField
            label="new term"
            placeholder="new term"
            value={newTerm}
            onChange={setNewTerm}
          />
          <TextAreaField
            name="new definition"
            placeholder="new definition"
            label="new definition"
            value={newDefinition}
            onChange={setNewDefinition}
            disabled={false}
          />
          <Button variant="primary" size="medium" onClick={() => createMutation.mutate()}>
            Save
          </Button>
        </div>
        {glossary.data
          .sort((a, b) => a.term.localeCompare(b.term))
          .map((t) => {
            return editingTerm === t.id ? (
              <div key={t.id}>
                <hr />
                <TextField
                  placeholder="updated term"
                  label="updated term"
                  value={updatedTerm}
                  onChange={setUpdatedTerm}
                />
                <TextAreaField
                  name="definition"
                  label="updated definition"
                  placeholder="updated definition"
                  value={updatedDefinition}
                  onChange={setUpdatedDefinition}
                  disabled={false}
                />
                <Button variant="primary" size="medium" onClick={() => updateMutation.mutate(t.id)}>
                  Save
                </Button>
                <Button variant="tertiary" size="medium" onClick={() => setEditingTerm(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div key={t.id}>
                <hr />
                <div>{t.term}</div>
                <div>{t.definition}</div>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => {
                    setUpdatedTerm(t.term)
                    setUpdatedDefinition(t.definition)
                    setEditingTerm(t.id)
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="tertiary"
                  size="medium"
                  onClick={() => deleteMutation.mutate(t.id)}
                >
                  Delete
                </Button>
              </div>
            )
          })}
      </>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(ManageGlossary)))
