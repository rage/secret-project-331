import { css } from "@emotion/css"
import { Box, Card, CardContent, CardHeader, IconButton, Modal } from "@material-ui/core"
import Dialog from "@material-ui/core/Dialog"
import DialogActions from "@material-ui/core/DialogActions"
import DialogContent from "@material-ui/core/DialogContent"
import DialogContentText from "@material-ui/core/DialogContentText"
import DialogTitle from "@material-ui/core/DialogTitle"
import CancelIcon from "@material-ui/icons/Cancel"
import DeleteIcon from "@material-ui/icons/Delete"
import DoneIcon from "@material-ui/icons/Done"
import EditIcon from "@material-ui/icons/Edit"
import ErrorIcon from "@material-ui/icons/Error"
import SaveIcon from "@material-ui/icons/Save"
import React, { useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import {
  addExerciseService,
  deleteExerciseService,
  fetchExerciseServices,
  updateExerciseService,
} from "../../../services/backend/exercise-services"
import { ExerciseService, ExerciseServiceNewOrUpdate } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import basePath from "../../../shared-module/utils/base-path"
import { validNumber, validURL } from "../../../shared-module/utils/validation"

import ContentArea from "./ContentArea"
import TimeComponent from "./TimeComponent"

interface ExerciseServiceEditorProps {
  exercise_services: ExerciseService[]
  refetch()
}

interface ExerciseServiceCardProps {
  key: string
  exercise_service: ExerciseService
  refetch()
}

interface ExerciseServiceCreationModelProps {
  onChange: (key: unknown) => (event: unknown) => void
  onChangeName: (event: unknown) => void
  exercise_service: ExerciseServiceNewOrUpdate
  handleSubmit()
  handleClose()
  open: boolean
}

type updateStatus = null | "saved" | "failed"

const convertToSlug = (name) => {
  return name.toLowerCase().replaceAll(" ", "-")
}

const canSave = (service) => {
  return (
    validNumber(service.max_reprocessing_submissions_at_once) &&
    service.max_reprocessing_submissions_at_once > 0 &&
    validURL(service.internal_url) &&
    validURL(service.public_url)
  )
}

const ExerciseServiceCard: React.FC<ExerciseServiceCardProps> = ({
  key,
  exercise_service,
  refetch,
}) => {
  const [editing, setEditing] = useState(false)
  const [service, setService] = useState(exercise_service)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
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

  const onChangeName = (event) => {
    setService({
      ...service,
      name: event.target.value,
      slug: convertToSlug(event.target.value),
    })
  }

  const updateContent = async () => {
    window.setTimeout(() => {
      setStatus(null)
    }, 4000)
    if (!canSave(service)) {
      setStatus("failed")
      return
    }
    try {
      const updated = await updateExerciseService(service.id, service)
      setService(updated)
      setStatus("saved")
      await refetch()
    } catch (e) {
      setStatus("failed")
      console.error(e)
    }
    window.setTimeout(() => {
      setStatus(null)
    }, 4000)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
  }

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true)
  }

  const deleteContent = async () => {
    try {
      await deleteExerciseService(service.id)
      await refetch()
    } catch (e) {
      setStatus("failed")
      console.error(e)
    }
  }

  return (
    <Box>
      <Card
        key={key}
        variant="outlined"
        className={css`
          margin: 8px;
          /* Override card's overflow */
          overflow: visible !important;
        `}
      >
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
                <IconButton onClick={handleOpenDeleteDialog}>
                  <DeleteIcon />
                </IconButton>
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
                onChange={onChangeName}
                type={"text"}
                error={false}
              />
              <ContentArea
                title={"Slug"}
                text={service.slug}
                editing={editing}
                onChange={onChange("slug")}
                type={"text"}
                error={false}
              />
            </>
          )}
          <ContentArea
            title={"Public URL"}
            text={service.public_url}
            editing={editing}
            onChange={onChange("public_url")}
            type={"text"}
            error={!validURL(service.public_url)}
          />
          <ContentArea
            title={"Internal URL"}
            text={service.internal_url}
            editing={editing}
            onChange={onChange("internal_url")}
            type={"text"}
            error={!validURL(service.internal_url)}
          />
          <ContentArea
            title={"Reprocessing submissions"}
            text={service.max_reprocessing_submissions_at_once}
            editing={editing}
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            error={service.max_reprocessing_submissions_at_once < 0}
          />
        </CardContent>

        <CardContent>
          <TimeComponent name={"Created: "} date={exercise_service.created_at} right={false} />
          <TimeComponent name={"Updated: "} date={exercise_service.updated_at} right={true} />
        </CardContent>
      </Card>
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle id="alert-dialog-title">{"Delete exercise service"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete &quot;{service.name}&quot;?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="primary" size="medium" onClick={handleCloseDeleteDialog}>
            Cancel
          </Button>
          <Button variant="secondary" size="medium" onClick={deleteContent}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

const ExerciseServiceContainer: React.FC<ExerciseServiceEditorProps> = ({
  exercise_services,
  refetch,
}) => (
  <div>
    {exercise_services.map((service) => (
      <ExerciseServiceCard key={service.id} exercise_service={service} refetch={refetch} />
    ))}
  </div>
)

const ExerciseServiceCreationModal: React.FC<ExerciseServiceCreationModelProps> = ({
  open,
  handleClose,
  exercise_service,
  onChange,
  onChangeName,
  handleSubmit,
}) => {
  return (
    <Modal
      className={css`
        display: flex;
        align-items: center;
        justify-content: center;
      `}
      open={open}
      onClose={handleClose}
      aria-labelledby="simple-modal-title"
      aria-describedby="simple-modal-description"
    >
      <Card
        className={css`
          width: 60%;
        `}
      >
        <CardHeader title={"Create exercise service"} />
        <CardContent>
          <ContentArea
            title={"Name"}
            text={exercise_service.name}
            editing={true}
            onChange={onChangeName}
            type={"text"}
            error={false}
          />
          <ContentArea
            title={"Slug"}
            text={exercise_service.slug}
            editing={true}
            onChange={onChange("slug")}
            type={"text"}
            error={false}
          />
          <ContentArea
            title={"Public URL"}
            text={exercise_service.public_url}
            editing={true}
            onChange={onChange("public_url")}
            type={"text"}
            error={!validURL(exercise_service.public_url)}
          />
          <ContentArea
            title={"Internal URL"}
            text={exercise_service.internal_url}
            editing={true}
            onChange={onChange("internal_url")}
            type={"text"}
            error={!validURL(exercise_service.internal_url)}
          />
          <ContentArea
            title={"Reprocessing submissions"}
            text={exercise_service.max_reprocessing_submissions_at_once}
            editing={true}
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            error={exercise_service.max_reprocessing_submissions_at_once < 0}
          />
        </CardContent>
        <CardContent>
          <Button variant="primary" size="medium" onClick={handleSubmit}>
            Create
          </Button>
          <Button variant="secondary" size="medium" onClick={handleClose}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </Modal>
  )
}

const ExerciseServicePage: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [exerciseService, setExerciseService] = useState({
    name: "",
    slug: "",
    public_url: "",
    internal_url: "",
    max_reprocessing_submissions_at_once: 1,
  })

  const resetExerciseService = () => {
    setExerciseService({
      name: "",
      slug: "",
      public_url: "",
      internal_url: "",
      max_reprocessing_submissions_at_once: 1,
    })
  }

  const onChangeName = (event) => {
    setExerciseService({
      ...exerciseService,
      name: event.target.value,
      slug: convertToSlug(event.target.value),
    })
  }

  const onChangeCreationModal = (key) => (event) => {
    setExerciseService({
      ...exerciseService,
      [key]: event.target.type === "number" ? parseInt(event.target.value) : event.target.value,
    })
  }

  const { isLoading, error, data, refetch } = useQuery(`exercise-services`, () =>
    fetchExerciseServices(),
  )

  if (error) {
    return <div>Error fetching exercise services.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  const handleClose = () => {
    setOpen(false)
  }

  const openModal = () => {
    setOpen(true)
  }

  const createExerciseService = async () => {
    if (!canSave(exerciseService)) {
      return
    }
    try {
      await addExerciseService(exerciseService)
      refetch()
      handleClose()
      resetExerciseService()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Layout navVariant={"simple"} frontPageUrl={basePath()}>
      <h1> Manage exercise services:</h1>
      <Button onClick={openModal} variant="primary" size="medium">
        Add new service
      </Button>
      <br />
      <ExerciseServiceContainer exercise_services={data} refetch={refetch} />
      <ExerciseServiceCreationModal
        open={open}
        handleClose={handleClose}
        exercise_service={exerciseService}
        onChange={onChangeCreationModal}
        onChangeName={onChangeName}
        handleSubmit={createExerciseService}
      />
    </Layout>
  )
}

export default ExerciseServicePage
