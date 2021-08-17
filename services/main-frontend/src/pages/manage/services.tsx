import { css } from "@emotion/css"
import { Box, Card, CardContent, CardHeader, IconButton, TextField } from "@material-ui/core"
import DoneIcon from "@material-ui/icons/Done"
import EditIcon from "@material-ui/icons/Edit"
import React, { ChangeEvent, useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import { fetchExerciseServices } from "../../services/backend/exercise-services"
import Button from "../../shared-module/components/Button"

interface ExerciseService {
  id: string
  name: string
  slug: string
  public_url: string
  internal_url: string
  max_reprocessing_submissions_at_once: number
  updated_at: Date
  created_at: Date
}

interface ExerciseServiceEditorProps {
  exercise_services: ExerciseService[]
}

interface ExerciseServiceCardProps {
  key: string
  exercise_service: ExerciseService
}

interface ContentAreaProps {
  title: string
  text: string | number
  editing: boolean
  onChange(value: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): unknown
}

const ContentArea: React.FC<ContentAreaProps> = ({ title, text, editing, onChange }) => {
  return (
    <div
      className={css`
        margin-bottom: 4px;
      `}
    >
      <strong>{title}:</strong>
      <br />
      {editing ? (
        <TextField onChange={onChange} fullWidth value={text} placeholder={`${title}...`} />
      ) : (
        <span>{text}</span>
      )}
    </div>
  )
}

const ExerciseServiceCard: React.FC<ExerciseServiceCardProps> = ({ key, exercise_service }) => {
  const [editing, setEditing] = useState(false)
  const [service, setService] = useState(exercise_service)

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const onChange = (key) => (event) => {
    setService({ ...service, [key]: event.target.value })
  }

  return (
    <Box width={800}>
      <Card key={key} variant="outlined">
        <CardHeader
          title={editing ? "Edit exercise service" : service.name}
          subheader={editing || `Slug: ${service.slug}`}
          action={
            <IconButton onClick={toggleEdit}> {editing ? <DoneIcon /> : <EditIcon />}</IconButton>
          }
        />
        <CardContent>
          {editing && (
            <>
              <ContentArea
                title={"Name"}
                text={service.name}
                editing={editing}
                onChange={onChange("name")}
              />
              <ContentArea
                title={"Slug"}
                text={service.slug}
                editing={editing}
                onChange={onChange("slug")}
              />
            </>
          )}
          <ContentArea
            title={"Public URL"}
            text={service.public_url}
            editing={editing}
            onChange={onChange("public_url")}
          />
          <ContentArea
            title={"Internal URL"}
            text={service.internal_url}
            editing={editing}
            onChange={onChange("internal_url")}
          />
          <ContentArea
            title={"Reprocessing submissions"}
            text={service.max_reprocessing_submissions_at_once}
            editing={editing}
            onChange={onChange("max_reprocessing_submissions_at_once")}
          />
        </CardContent>

        <CardContent>
          <span>
            <strong>Created:</strong>
            <span> {service.created_at.toLocaleDateString("fi-FI")} </span>
          </span>
          <span
            className={css`
              float: right;
            `}
          >
            <strong>Updated:</strong>
            <span> {service.updated_at.toLocaleDateString("fi-FI")} </span>
          </span>
        </CardContent>
      </Card>
    </Box>
  )
}

const ExerciseServiceContainer: React.FC<ExerciseServiceEditorProps> = ({ exercise_services }) => (
  <div>
    {exercise_services.map((service) => (
      <ExerciseServiceCard key={service.id} exercise_service={service} />
    ))}
  </div>
)

const ExerciseServicePage: React.FC = () => {
  const { isLoading, error, data } = useQuery(`exercise-services`, () => fetchExerciseServices())

  if (error) {
    return <div>Error fetching exercise services.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  return (
    <Layout>
      <h1> Manage exercise services:</h1>
      <ExerciseServiceContainer exercise_services={data} />
      <br />
      <Button variant="primary" size="medium">
        Add new service
      </Button>
    </Layout>
  )
}

export default ExerciseServicePage
