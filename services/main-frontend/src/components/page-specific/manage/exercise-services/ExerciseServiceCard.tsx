import { css } from "@emotion/css"
import { QueryObserverResult } from "@tanstack/react-query"
import {
  BellXmark,
  CheckCircle,
  FloppyDiskSave,
  Pencil,
  Trash,
  XmarkCircle,
} from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  deleteExerciseService,
  updateExerciseService,
} from "../../../../services/backend/exercise-services"
import {
  ExerciseService,
  ExerciseServiceNewOrUpdate,
} from "../../../../shared-module/common/bindings"
import Button from "../../../../shared-module/common/components/Button"
import Dialog from "../../../../shared-module/common/components/Dialog"
import TimeComponent from "../../../../shared-module/common/components/TimeComponent"
import { validURL } from "../../../../shared-module/common/utils/validation"
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
      <div
        key={id}
        className={css`
          margin: 8px;
          padding: 1rem;
          border: 1px solid rgba(0, 0, 0, 0.12);
          /* Override card's overflow */
          overflow: visible !important;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            line-height: 1.5;
            padding-bottom: 1.5rem;
            align-items: baseline;
          `}
        >
          <div>
            <h1
              className={css`
                margin: 0;
                font-weight: 400;
                font-size: 1.5rem;
              `}
            >
              {editing ? t("edit") : service.name}
            </h1>
            <div
              className={css`
                margin: 0;
                font-weight: 400;
                font-size: 1rem;
                color: rgba(0, 0, 0, 0.6);
              `}
            >
              {editing || t("header-slug", { slug: service.slug })}
            </div>
          </div>

          {editing ? (
            <div
              className={css`
                display: flex;
                flex-direction: row;
              `}
            >
              <Button
                aria-label={t("button-text-save")}
                onClick={updateContent}
                variant={"icon"}
                size={"small"}
              >
                {status == UpdateStatus.none ? (
                  <FloppyDiskSave size={20} />
                ) : status == UpdateStatus.saved ? (
                  <CheckCircle size={20} />
                ) : (
                  <BellXmark size={20} />
                )}
              </Button>
              <Button
                aria-label={t("button-text-cancel")}
                onClick={toggleEdit}
                variant={"icon"}
                size={"small"}
              >
                <XmarkCircle size={20} />
              </Button>
            </div>
          ) : (
            <div
              className={css`
                display: flex;
                flex-direction: row;
              `}
            >
              <Button
                aria-label={t("button-text-delete")}
                onClick={handleOpenDeleteDialog}
                variant={"icon"}
                size={"small"}
              >
                <Trash size={20} />
              </Button>
              <Button aria-label={t("edit")} onClick={toggleEdit} variant={"icon"} size={"small"}>
                <Pencil size={20} />
              </Button>
            </div>
          )}
        </div>
        <div>
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
        </div>
        <div
          className={css`
            display: flex;
            justify-content: space-between;
            padding-top: 1rem;
          `}
        >
          <TimeComponent
            label={`${t("label-created")} `}
            date={parseISO(exerciseService.created_at)}
            right={false}
            boldLabel
          />
          <TimeComponent
            label={`${t("label-updated")} `}
            boldLabel
            date={parseISO(exerciseService.updated_at)}
            right={true}
          />
        </div>
      </div>
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        noPadding
        id={`${id}"alert-dialog-title"`}
      >
        <div
          className={css`
            display: flex;
            flex-direction: column;
          `}
        >
          <h2
            className={css`
              padding: 16px 24px;
            `}
          >
            {t("button-text-delete")}
          </h2>

          <div
            className={css`
              padding: 0px 24px 20px;
            `}
          >
            {t("delete-confirmation", { name: service.name })}
          </div>
          <div
            className={css`
              padding: 8px;
              display: flex;
              justify-content: flex-end;
            `}
          >
            <Button variant="primary" size="medium" onClick={handleCloseDeleteDialog}>
              {t("button-text-cancel")}
            </Button>
            <Button variant="secondary" size="medium" onClick={deleteContent}>
              {t("button-text-delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default ExerciseServiceCard
