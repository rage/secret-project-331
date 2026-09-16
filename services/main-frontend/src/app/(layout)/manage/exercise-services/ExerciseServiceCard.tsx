"use client"

import { css } from "@emotion/css"
import type { QueryObserverResult } from "@tanstack/react-query"
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
  deleteExerciseServiceMutation as deleteExerciseServiceMutationOptions,
  updateExerciseServiceMutation as updateExerciseServiceMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseService, ExerciseServiceNewOrUpdate } from "@/generated/api/types.generated"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { validURL } from "@/shared-module/common/utils/validation"
import { Button, ConfirmDialog } from "@/shared-module/components"
import { canSave } from "@/utils/canSaveExerciseService"
import { convertToSlug } from "@/utils/convert"
import { prepareExerciseServiceForBackend } from "@/utils/prepareServiceForBackend.ts"

import ContentArea from "./ContentArea"

interface ExerciseServiceCardProps {
  id: string
  exerciseService: ExerciseService
  refetch: () => Promise<QueryObserverResult<ExerciseService[], unknown>>
}

enum UpdateStatus {
  none = 0,
  saved = 1,
  failed = 2,
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
      [key]: key === "max_reprocessing_submissions_at_once" ? Number(value) : value,
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
    if (!canSave(service)) {
      setStatus(UpdateStatus.failed)
      return
    }

    if ("id" in service) {
      await updateMutation.mutateAsync({
        path: {
          exercise_service_id: service.id,
        },
        body: prepareExerciseServiceForBackend(service),
      })
    }
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
  }

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true)
  }

  const deleteContent = async () => {
    if ("id" in service) {
      await deleteMutation.mutateAsync({
        path: {
          exercise_service_id: service.id,
        },
      })
    }
  }

  const updateMutation = useToastMutationOptions(
    updateExerciseServiceMutationOptions(),
    { notify: false },
    {
      onSuccess: async (updated) => {
        if (updated.service_info_error) {
          showErrorNotification({
            header: t("could-not-connect-to-exercise-service-header"),
            message: t("could-not-connect-to-exercise-service-message", {
              message: updated.service_info_error,
            }),
          })
        }

        setService(updated.exercise_service)
        setStatus(UpdateStatus.saved)
        await refetch()
        window.setTimeout(() => {
          setStatus(UpdateStatus.none)
        }, 4000)
      },
      onError: () => {
        setStatus(UpdateStatus.failed)
        window.setTimeout(() => {
          setStatus(UpdateStatus.none)
        }, 4000)
      },
    },
  )

  const deleteMutation = useToastMutationOptions(
    deleteExerciseServiceMutationOptions(),
    { notify: false },
    {
      onSuccess: async () => {
        setDeleteDialogOpen(false)
        await refetch()
      },
      onError: () => {
        setStatus(UpdateStatus.failed)
      },
    },
  )

  return (
    <div data-testid={`exercise-service-card-${exerciseService.slug}`}>
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
            <h2
              className={css`
                margin: 0;
                font-weight: 400;
                font-size: 1.5rem;
              `}
            >
              {editing ? t("edit") : service.name}
            </h2>
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
                gap: var(--space-3);
              `}
            >
              <Button
                aria-label={t("button-text-save")}
                onClick={updateContent}
                variant={"icon"}
                size={"small"}
              >
                {status === UpdateStatus.none ? (
                  <FloppyDiskSave size={20} />
                ) : status === UpdateStatus.saved ? (
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
                gap: var(--space-3);
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
                // oxlint-disable-next-line i18next/no-literal-string
                onChange={onChange("slug")}
                type={"text"}
              />
            </>
          )}
          <ContentArea
            title={t("title-public-url")}
            text={service.public_url}
            editing={editing}
            // oxlint-disable-next-line i18next/no-literal-string
            onChange={onChange("public_url")}
            type={"text"}
            {...includeIf(!!service.public_url && !validURL(service.public_url), {
              error: t("invalid-url"),
            })}
          />
          <ContentArea
            title={t("title-internal-url")}
            text={service.internal_url ?? null}
            editing={editing}
            // oxlint-disable-next-line i18next/no-literal-string
            onChange={onChange("internal_url")}
            type={"text"}
            {...includeIf(!!service.internal_url && !validURL(service.internal_url), {
              error: t("invalid-url"),
            })}
          />
          <ContentArea
            title={t("title-reprocessing-submissions")}
            text={service.max_reprocessing_submissions_at_once}
            editing={editing}
            // oxlint-disable-next-line i18next/no-literal-string
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            {...includeIf(service.max_reprocessing_submissions_at_once < 0, {
              error: t("error-title"),
            })}
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
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        title={t("button-text-delete")}
        description={t("delete-confirmation", { name: service.name })}
        confirmLabel={t("button-text-delete")}
        cancelLabel={t("button-text-cancel")}
        isDestructive
        onConfirm={deleteContent}
      />
    </div>
  )
}

export default ExerciseServiceCard
