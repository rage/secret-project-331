import { css } from "@emotion/css"
import { Box, Card, CardContent, CardHeader, IconButton, TextField } from "@material-ui/core"
import CancelIcon from "@material-ui/icons/Cancel"
import DoneIcon from "@material-ui/icons/Done"
import EditIcon from "@material-ui/icons/Edit"
import ErrorIcon from "@material-ui/icons/Error"
import SaveIcon from "@material-ui/icons/Save"
import React, { ChangeEvent, useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import {
  fetchExerciseServices,
  updateExerciseService,
} from "../../services/backend/exercise-services"
import { ExerciseService } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"

interface ExerciseServiceEditorProps {
  exercise_services: ExerciseService[]
}

interface ExerciseServiceCardProps {
  key: string
  exercise_service: ExerciseService
}

type inputType = "number" | "text"

interface ContentAreaProps {
  title: string
  text: string | number
  editing: boolean
  onChange(value: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): unknown
  type: inputType
}

type updateStatus = null | "saved" | "failed"

const ContentArea: React.FC<ContentAreaProps> = ({ title, text, editing, onChange, type }) => {
  return (
    <div
      className={css`
        margin-bottom: 8px;
      `}
    >
      <strong>{title}:</strong>
      <br />
      {editing ? (
        type == "text" ? (
          <TextField onChange={onChange} fullWidth value={text} placeholder={`${title}...`} />
        ) : (
          <TextField
            onChange={onChange}
            type={"number"}
            InputProps={{
              inputProps: { min: 1 },
            }}
            fullWidth
            value={text}
            placeholder={`${title}...`}
          />
        )
      ) : (
        <span>{text}</span>
      )}
    </div>
  )
}

const ExerciseServiceCard: React.FC<ExerciseServiceCardProps> = ({ key, exercise_service }) => {
  const [editing, setEditing] = useState(false)
  const [service, setService] = useState(exercise_service)

  // Saving animation for the card
  const [status, setStatus] = useState<updateStatus>(null)

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const onChange = (key) => (event) => {
    setService({
      ...service,
      [key]: event.target.type === "number" ? parseInt(event.target.value) : event.target.value,
    })
  }

  const updateContent = async () => {
    try {
      const updated = await updateExerciseService(service.id, service)
      setService(updated)
      setStatus("saved")
    } catch (e) {
      setStatus("failed")
      console.error(e)
    }
    window.setTimeout(() => {
      setStatus(null)
    }, 4000)
  }

  return (
    <Box width={700}>
      <Card key={key} variant="outlined">
        <CardHeader
          title={editing ? "Edit exercise service" : service.name}
          subheader={editing || `Slug: ${service.slug}`}
          action={
            editing ? (
              <>
                <IconButton onClick={updateContent}>
                  {status == null ? <SaveIcon /> : status == "saved" ? <DoneIcon /> : <ErrorIcon />}
                </IconButton>
                <IconButton onClick={toggleEdit}>
                  <CancelIcon />
                </IconButton>
              </>
            ) : (
              <div>
                <IconButton onClick={toggleEdit}>
                  <EditIcon />
                </IconButton>
              </div>
            )
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
                type={"text"}
              />
              <ContentArea
                title={"Slug"}
                text={service.slug}
                editing={editing}
                onChange={onChange("slug")}
                type={"text"}
              />
            </>
          )}
          <ContentArea
            title={"Public URL"}
            text={service.public_url}
            editing={editing}
            onChange={onChange("public_url")}
            type={"text"}
          />
          <ContentArea
            title={"Internal URL"}
            text={service.internal_url}
            editing={editing}
            onChange={onChange("internal_url")}
            type={"text"}
          />
          <ContentArea
            title={"Reprocessing submissions"}
            text={service.max_reprocessing_submissions_at_once}
            editing={editing}
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
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
