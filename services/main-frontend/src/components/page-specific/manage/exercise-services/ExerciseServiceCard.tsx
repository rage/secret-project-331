import { css } from "@emotion/css"
import { Box, Card, CardContent, CardHeader, IconButton } from "@material-ui/core"
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
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { QueryObserverResult } from "react-query"

import {
  deleteExerciseService,
  updateExerciseService,
} from "../../../../services/backend/exercise-services"
import { ExerciseService, ExerciseServiceNewOrUpdate } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import TimeComponent from "../../../../shared-module/components/TimeComponent"
import { validURL } from "../../../../shared-module/utils/validation"
import { canSave } from "../../../../utils/canSaveExerciseService"
import { convertToSlug } from "../../../../utils/convert"

import ContentArea from "./ContentArea"

interface ExerciseServiceCardProps {
  key: string
  exerciseService: ExerciseService
  refetch(): Promise<QueryObserverResult<ExerciseService[], unknown>>
}

enum UpdateStatus {
  "none",
  "saved",
  "failed",
}

const ExerciseServiceCard: React.FC<ExerciseServiceCardProps> = ({
  key,
  exerciseService,
  refetch,
}) => {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<boolean>(false)
  const [service, setService] = useState<ExerciseServiceNewOrUpdate | ExerciseService>(
    exerciseService,
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const [status, setStatus] = useState<UpdateStatus>(UpdateStatus.none)

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const onChange = (key: string) => (value: string) => {
    setService({
      ...service,
      [key]: value,
    })
  }

  const onChangeName = (value: string) => {
    setService({
      ...service,
      name: value,
      slug: convertToSlug(value),
    })
  }

  const updateContent = async () => {
    window.setTimeout(() => {
      setStatus(UpdateStatus.none)
    }, 4000)
    if (!canSave(service)) {
      setStatus(UpdateStatus.failed)
      return
    }
    try {
      if ("id" in service) {
        const updated = await updateExerciseService(service.id, service)
        setService(updated)
        setStatus(UpdateStatus.saved)
        await refetch()
      }
    } catch (e) {
      setStatus(UpdateStatus.failed)
      throw e
    }
    window.setTimeout(() => {
      setStatus(UpdateStatus.none)
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
      setStatus(UpdateStatus.failed)
      throw e
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
                <IconButton aria-label={t("button-text-save")} onClick={updateContent}>
                  {status == UpdateStatus.none ? (
                    <SaveIcon />
                  ) : status == UpdateStatus.saved ? (
                    <DoneIcon />
                  ) : (
                    <ErrorIcon />
                  )}
                </IconButton>
                <IconButton aria-label={t("button-text-cancel")} onClick={toggleEdit}>
                  <CancelIcon />
                </IconButton>
              </>
            ) : (
              <div>
                <IconButton aria-label={t("button-text-delete")} onClick={handleOpenDeleteDialog}>
                  <DeleteIcon />
                </IconButton>
                <IconButton aria-label={t("edit")} onClick={toggleEdit}>
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
                title={t("text-field-label-or-header-slug-or-short-name")}
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
            date={exerciseService.created_at}
            right={false}
          />
          <TimeComponent
            name={`${t("label-updated")} `}
            date={exerciseService.updated_at}
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

export default ExerciseServiceCard
