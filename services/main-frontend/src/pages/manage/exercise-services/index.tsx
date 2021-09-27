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
import { useTranslation } from "react-i18next"
import { QueryObserverResult, useQuery } from "react-query"

import Layout from "../../../components/Layout"
import {
  addExerciseService,
  deleteExerciseService,
  fetchExerciseServices,
  updateExerciseService,
} from "../../../services/backend/exercise-services"
import { ExerciseService, ExerciseServiceNewOrUpdate } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import TimeComponent from "../../../shared-module/components/TimeComponent"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import basePath from "../../../shared-module/utils/base-path"
import { validNumber, validURL } from "../../../shared-module/utils/validation"

import ContentArea from "./ContentArea"

interface ExerciseServiceEditorProps {
  exercise_services: ExerciseService[]
  refetch(): Promise<QueryObserverResult<[ExerciseService], unknown>>
}

interface ExerciseServiceCardProps {
  key: string
  exercise_service: ExerciseService
  refetch(): Promise<QueryObserverResult<[ExerciseService], unknown>>
}

interface ExerciseServiceCreationModelProps {
  onChange: (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => void
  onChangeName: (event: React.ChangeEvent<HTMLInputElement>) => void
  exercise_service: ExerciseServiceNewOrUpdate
  handleSubmit(): Promise<void>
  handleClose(): void
  open: boolean
}

type UpdateStatus = null | "saved" | "failed"

const convertToSlug = (name: string) => {
  return name.toLowerCase().trim().replaceAll(" ", "-")
}

const canSave = (service: ExerciseServiceNewOrUpdate) => {
  return (
    validNumber(service.max_reprocessing_submissions_at_once.toString()) &&
    service.max_reprocessing_submissions_at_once > 0 &&
    validURL(service.internal_url ?? "") &&
    validURL(service.public_url)
  )
}

const ExerciseServiceCard: React.FC<ExerciseServiceCardProps> = ({
  key,
  exercise_service,
  refetch,
}) => {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<boolean>(false)
  const [service, setService] = useState<ExerciseServiceNewOrUpdate | ExerciseService>(
    exercise_service,
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const [status, setStatus] = useState<UpdateStatus>(null)

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const onChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setService({
      ...service,
      [key]: event.target.type === "number" ? parseInt(event.target.value) : event.target.value,
    })
  }

  const onChangeName = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      // eslint-disable-next-line i18next/no-literal-string
      setStatus("failed")
      return
    }
    try {
      if ("id" in service) {
        const updated = await updateExerciseService(service.id, service)
        setService(updated)
        // eslint-disable-next-line i18next/no-literal-string
        setStatus("saved")
        await refetch()
      }
    } catch (e) {
      // eslint-disable-next-line i18next/no-literal-string
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
      if ("id" in service) {
        await deleteExerciseService(service.id)
        await refetch()
      }
    } catch (e) {
      // eslint-disable-next-line i18next/no-literal-string
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
          title={editing ? t("edit") : service.name}
          subheader={editing || t("header-slug", { slug: service.slug })}
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
                title={t("text-field-label-name")}
                text={service.name}
                editing={editing}
                onChange={onChangeName}
                type={"text"}
                error={false}
              />
              <ContentArea
                title={t("text-field-label-or-header-slug")}
                text={service.slug}
                editing={editing}
                // eslint-disable-next-line i18next/no-literal-string
                onChange={onChange("slug")}
                type={"text"}
                error={false}
              />
            </>
          )}
          <ContentArea
            title={t("title-public-url")}
            text={service.public_url}
            editing={editing}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("public_url")}
            type={"text"}
            error={!validURL(service.public_url)}
          />
          <ContentArea
            title={t("title-internal-url")}
            text={service.internal_url}
            editing={editing}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("internal_url")}
            type={"text"}
            error={!validURL(service.internal_url ?? "")}
          />
          <ContentArea
            title={t("title-reprocessing-submissions")}
            text={service.max_reprocessing_submissions_at_once}
            editing={editing}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            error={service.max_reprocessing_submissions_at_once < 0}
          />
        </CardContent>

        <CardContent>
          <TimeComponent
            name={`${t("label-created")} `}
            date={exercise_service.created_at}
            right={false}
          />
          <TimeComponent
            name={`${t("label-updated")} `}
            date={exercise_service.updated_at}
            right={true}
          />
        </CardContent>
      </Card>
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle id="alert-dialog-title">{t("button-text-delete")}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {t("delete-confirmation", { name: service.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="primary" size="medium" onClick={handleCloseDeleteDialog}>
            {t("button-text-cancel")}
          </Button>
          <Button variant="secondary" size="medium" onClick={deleteContent}>
            {t("button-text-delete")}
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
  const { t } = useTranslation()
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
        <CardHeader title={t("button-text-create")} />
        <CardContent>
          <ContentArea
            title={t("text-field-label-name")}
            text={exercise_service.name}
            editing={true}
            onChange={onChangeName}
            type={"text"}
            error={false}
          />
          <ContentArea
            title={t("text-field-label-or-header-slug")}
            text={exercise_service.slug}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("slug")}
            type={"text"}
            error={false}
          />
          <ContentArea
            title={t("title-public-url")}
            text={exercise_service.public_url}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("public_url")}
            type={"text"}
            error={!validURL(exercise_service.public_url)}
          />
          <ContentArea
            title={t("title-internal-url")}
            text={exercise_service.internal_url}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("internal_url")}
            type={"text"}
            error={!validURL(exercise_service.internal_url ?? "")}
          />
          <ContentArea
            title={t("title-reprocessing-submissions")}
            text={exercise_service.max_reprocessing_submissions_at_once}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            error={exercise_service.max_reprocessing_submissions_at_once < 0}
          />
        </CardContent>
        <CardContent>
          <Button variant="primary" size="medium" onClick={handleSubmit}>
            {t("button-text-create")}
          </Button>
          <Button variant="secondary" size="medium" onClick={handleClose}>
            {t("button-text-cancel")}
          </Button>
        </CardContent>
      </Card>
    </Modal>
  )
}

const ExerciseServicePage: React.FC = () => {
  const { t } = useTranslation()
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

  const onChangeName = (event: React.ChangeEvent<HTMLInputElement>) => {
    setExerciseService({
      ...exerciseService,
      name: event.target.value,
      slug: convertToSlug(event.target.value),
    })
  }

  const onChangeCreationModal = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setExerciseService({
      ...exerciseService,
      [key]: event.target.type === "number" ? parseInt(event.target.value) : event.target.value,
    })
  }

  const { isLoading, error, data, refetch } = useQuery(`exercise-services`, () =>
    fetchExerciseServices(),
  )

  if (error) {
    return <div>{t("error-title")}</div>
  }

  if (isLoading || !data) {
    return <div>{t("loading-text")}</div>
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
    <Layout navVariant={"simple"} frontPageUrl={basePath() + "/../.."}>
      <div className={normalWidthCenteredComponentStyles}>
        <h2>{t("title-manage-exercise-services")}</h2>
        <Button onClick={openModal} variant="primary" size="medium">
          {t("button-text-new")}
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
      </div>
    </Layout>
  )
}

export default ExerciseServicePage
