import { css } from "@emotion/css"
import CancelIcon from "@mui/icons-material/Cancel"
import DeleteIcon from "@mui/icons-material/Delete"
import DoneIcon from "@mui/icons-material/Done"
import EditIcon from "@mui/icons-material/Edit"
import ErrorIcon from "@mui/icons-material/Error"
import SaveIcon from "@mui/icons-material/Save"
import { Card, CardContent, CardHeader, IconButton } from "@mui/material"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogContentText from "@mui/material/DialogContentText"
import DialogTitle from "@mui/material/DialogTitle"
import { QueryObserverResult } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

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
import { prepareExerciseServiceForBackend } from "../../../../utils/prepareServiceForBackend.ts"

import ContentArea from "./ContentArea"

interface ExerciseServiceCardProps {
  id: string
  exerciseService: ExerciseService
  refetch(): Promise<QueryObserverResult<ExerciseService[], unknown>>
}

enum UpdateStatus {
  "none",
  "saved",
  "failed",
}

const ExerciseServiceCard: React.FC<React.PropsWithChildren<ExerciseServiceCardProps>> = ({
  id,
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
        const preparedService: ExerciseService = prepareExerciseServiceForBackend(
          service,
        ) as ExerciseService
        const updated = await updateExerciseService(service.id, preparedService)
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
    <div>
      <Card
        key={id}
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
              />
              <ContentArea
                title={t("text-field-label-or-header-slug-or-short-name")}
                text={service.slug}
                editing={editing}
                // eslint-disable-next-line i18next/no-literal-string
                onChange={onChange("slug")}
                type={"text"}
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
            error={!validURL(service.public_url) ? t("error-title") : undefined}
          />
          <ContentArea
            title={t("title-internal-url")}
            text={service.internal_url}
            editing={editing}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("internal_url")}
            type={"text"}
            error={!validURL(service.internal_url ?? "") ? t("error-title") : undefined}
          />
          <ContentArea
            title={t("title-reprocessing-submissions")}
            text={service.max_reprocessing_submissions_at_once}
            editing={editing}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            error={service.max_reprocessing_submissions_at_once < 0 ? t("error-title") : undefined}
          />
        </CardContent>

        <CardContent>
          <TimeComponent
            label={`${t("label-created")} `}
            date={exerciseService.created_at}
            right={false}
            boldLabel
          />
          <TimeComponent
            label={`${t("label-updated")} `}
            boldLabel
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
    </div>
  )
}

export default ExerciseServiceCard
