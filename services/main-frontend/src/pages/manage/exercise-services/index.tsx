import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseServiceContainer from "../../../components/page-specific/manage/exercise-services/ExerciseServiceContainer"
import ExerciseServiceCreationModal from "../../../components/page-specific/manage/exercise-services/ExerciseServiceCreationModal"
import {
  addExerciseService,
  fetchExerciseServices,
} from "../../../services/backend/exercise-services"
import { ExerciseServiceNewOrUpdate } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import { canSave } from "../../../utils/canSaveExerciseService"
import { convertToSlug } from "../../../utils/convert"
import { prepareExerciseServiceForBackend } from "../../../utils/prepareServiceForBackend.ts"

const ExerciseServicePage: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [exerciseService, setExerciseService] = useState<ExerciseServiceNewOrUpdate>({
    name: "",
    slug: "",
    public_url: "",
    internal_url: "",
    max_reprocessing_submissions_at_once: 1,
  })
  const createExerciseServiceMutation = useToastMutation(
    async () => {
      if (!canSave(exerciseService)) {
        return
      }
      const processedService = prepareExerciseServiceForBackend(exerciseService)
      await addExerciseService(processedService)
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        getExerciseServices.refetch()
        handleClose()
        resetExerciseService()
      },
    },
  )

  const resetExerciseService = () => {
    setExerciseService({
      name: "",
      slug: "",
      public_url: "",
      internal_url: "",
      max_reprocessing_submissions_at_once: 1,
    })
  }

  const onChangeName = (value: string) => {
    setExerciseService({
      ...exerciseService,
      name: value,
      slug: convertToSlug(value),
    })
  }

  const onChangeCreationModal = (key: string) => (value: string) => {
    if (key === "max_reprocessing_submissions_at_once") {
      try {
        setExerciseService({
          ...exerciseService,
          [key]: Number(value),
        })
      } catch (e) {
        // NOP
      }
    } else {
      setExerciseService({
        ...exerciseService,
        [key]: value,
      })
    }
  }

  const getExerciseServices = useQuery([`exercise-services`], () => fetchExerciseServices())

  const handleClose = () => {
    setOpen(false)
  }

  const openModal = () => {
    setOpen(true)
  }

  return (
    <div>
      <h1>{t("title-manage-exercise-services")}</h1>
      <Button onClick={openModal} variant="primary" size="medium">
        {t("button-text-new")}
      </Button>
      <br />
      {getExerciseServices.isError && (
        <ErrorBanner variant={"readOnly"} error={getExerciseServices.error} />
      )}
      {getExerciseServices.isLoading && <Spinner variant={"medium"} />}
      {getExerciseServices.isSuccess && (
        <>
          <ExerciseServiceContainer
            exerciseServices={getExerciseServices.data}
            refetch={getExerciseServices.refetch}
          />
          <ExerciseServiceCreationModal
            open={open}
            handleClose={handleClose}
            exercise_service={exerciseService}
            onChange={onChangeCreationModal}
            onChangeName={onChangeName}
            handleSubmit={async () => {
              createExerciseServiceMutation.mutateAsync()
            }}
          />
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(ExerciseServicePage)
