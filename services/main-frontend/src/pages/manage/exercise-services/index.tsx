import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import ExerciseServiceContainer from "../../../components/page-specific/manage/exercise-services/ExerciseServiceContainer"
import ExerciseServiceCreationModal from "../../../components/page-specific/manage/exercise-services/ExerciseServiceCreationModal"
import {
  addExerciseService,
  fetchExerciseServices,
} from "../../../services/backend/exercise-services"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import basePath from "../../../shared-module/utils/base-path"
import { canSave } from "../../../utils/canSaveExerciseService"
import { convertToSlug } from "../../../utils/convert"

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

  const getExerciseServices = useQuery(`exercise-services`, () => fetchExerciseServices())

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
      getExerciseServices.refetch()
      handleClose()
      resetExerciseService()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Layout navVariant={"simple"} frontPageUrl={basePath() + "/../.."}>
      <div className={normalWidthCenteredComponentStyles}>
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
              exercise_services={getExerciseServices.data}
              refetch={getExerciseServices.refetch}
            />
            <ExerciseServiceCreationModal
              open={open}
              handleClose={handleClose}
              exercise_service={exerciseService}
              onChange={onChangeCreationModal}
              onChangeName={onChangeName}
              handleSubmit={createExerciseService}
            />
          </>
        )}
      </div>
    </Layout>
  )
}

export default ExerciseServicePage
