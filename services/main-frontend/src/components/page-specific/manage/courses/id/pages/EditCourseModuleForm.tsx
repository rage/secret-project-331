import { css } from "@emotion/css"
import { CheckCircle, Pencil, Trash, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ModuleView } from "./CourseModules"

import Button from "@/shared-module/common/components/Button"
import Checkbox from "@/shared-module/common/components/InputFields/CheckBox"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface Props {
  module: ModuleView
  chapters: Array<number>
  onSubmitForm: (id: string, fields: EditCourseModuleFormFields) => void
  onDeleteModule: (id: string) => void
}

export interface EditCourseModuleFormFields {
  name: string | null
  starts: number
  ends: number
  ects_credits: number | null
  uh_course_code: string | null
  automatic_completion: boolean
  automatic_completion_number_of_points_treshold: number | null
  automatic_completion_number_of_exercises_attempted_treshold: number | null
  automatic_completion_requires_exam: boolean
  override_completion_link: boolean
  completion_registration_link_override: string
  enable_registering_completion_to_uh_open_university: boolean
}

const makeDefaultValues = (module: ModuleView, chapters: number[]): EditCourseModuleFormFields => {
  return {
    name: module.name,
    starts: module.firstChapter ?? (chapters.length > 0 ? chapters[0] : 1),
    ends: module.lastChapter ?? (chapters.length > 0 ? chapters[chapters.length - 1] : 1),
    ects_credits: Number(module.ects_credits) || 0,
    uh_course_code: module.uh_course_code ?? "",
    automatic_completion: module.automatic_completion ?? false,
    automatic_completion_number_of_points_treshold:
      module.automatic_completion_number_of_points_treshold
        ? Number(module.automatic_completion_number_of_points_treshold)
        : null,
    automatic_completion_number_of_exercises_attempted_treshold:
      module.automatic_completion_number_of_exercises_attempted_treshold
        ? Number(module.automatic_completion_number_of_exercises_attempted_treshold)
        : null,
    automatic_completion_requires_exam: module.automatic_completion_requires_exam,
    override_completion_link: module.completion_registration_link_override !== null,
    completion_registration_link_override: module.completion_registration_link_override ?? "",
    enable_registering_completion_to_uh_open_university:
      module.enable_registering_completion_to_uh_open_university,
  }
}

const EditCourseModuleForm: React.FC<Props> = ({
  module,
  chapters,
  onSubmitForm,
  onDeleteModule,
}) => {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
    watch,
  } = useForm<EditCourseModuleFormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: makeDefaultValues(module, chapters),
  })
  useEffect(() => {
    reset(makeDefaultValues(module, chapters))
  }, [reset, module, chapters])

  const onSubmitFormWrapper = (fields: EditCourseModuleFormFields) => {
    setActive(false)
    onSubmitForm(module.id, fields)
  }

  const isChecked = watch("automatic_completion")
  const overrideLink = watch("override_completion_link")

  return (
    <form
      onSubmit={handleSubmit(onSubmitFormWrapper)}
      className={css`
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        background-color: #f7f8f9;
        color: #1a2333;
        align-items: center;
        justify-content: space-between;
        border: 2px solid #e1e3e5;
        border-top-right-radius: 4px;
        border-top-left-radius: 4px;
      `}
    >
      <div
        className={css`
          text-transform: uppercase;
          font-weight: 600;
          margin: 1rem 1.25rem;
          flex-grow: 1;
          ${respondToOrLarger.sm} {
            max-width: 16rem;
          }
        `}
      >
        {module.name ? (
          active ? (
            <TextField
              label={t("edit-module")}
              labelStyle={css`
                color: ${baseTheme.colors.clear[100]};
              `}
              placeholder={t("name-of-module")}
              {...register("name", { required: true })}
              error={errors["name"]?.message}
            />
          ) : (
            `${module.order_number}. ${module.name}`
          )
        ) : (
          t("default-module")
        )}
      </div>
      <div
        className={css`
          ${active && `width: 100%;`}
        `}
      >
        {active && (
          <div
            className={css`
              margin-left: 1rem;
              margin-right: 1rem;
              margin-bottom: 1rem;
            `}
          >
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                justify-content: left;
                column-gap: 1rem;
                margin-bottom: 1rem;

                ${respondToOrLarger.md} {
                  align-items: flex-end;
                  flex-direction: row;
                }
              `}
            >
              <div
                className={css`
                  column-gap: 1rem;
                  display: flex;
                  flex: 2;
                `}
              >
                <SelectField
                  className={css`
                    flex: 1;
                    min-width: 5rem;
                    margin-bottom: 0;
                  `}
                  id="editing-module-start"
                  label={t("starts")}
                  labelStyle={css`
                    color: ${baseTheme.colors.gray[500]};
                  `}
                  options={chapters.map((c) => {
                    return { value: c.toString(), label: c.toString() }
                  })}
                  {...register("starts", { required: true, valueAsNumber: true })}
                  error={errors["starts"]?.message}
                />
                <SelectField
                  className={css`
                    flex: 1;
                    min-width: 5rem;
                    margin-bottom: 0;
                  `}
                  id="editing-module-ends"
                  label={t("ends")}
                  labelStyle={css`
                    color: ${baseTheme.colors.gray[500]};
                  `}
                  options={chapters.map((cn) => {
                    return { value: cn.toString(), label: cn.toString() }
                  })}
                  {...register("ends", { required: true, valueAsNumber: true })}
                  error={errors["ends"]?.message}
                />
              </div>
            </div>

            <Checkbox
              label={t("enable-automatic-completion")}
              {...register("automatic_completion")}
            />
            <div
              className={css`
                align-items: center;
                display: flex;
                column-gap: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <TextField
                className={css`
                  flex: 1;
                  margin-bottom: 0;
                `}
                type="number"
                label={t("automatic-completion-points-treshold")}
                placeholder={t("automatic-completion-points-treshold")}
                {...register("automatic_completion_number_of_points_treshold", {
                  valueAsNumber: true,
                  disabled: !isChecked,
                })}
                error={errors["name"]?.message}
              />
              <TextField
                className={css`
                  flex: 1;
                  margin-bottom: 0;
                `}
                label={t("automatic-completion-exercise-treshold")}
                placeholder={t("automatic-completion-exercise-treshold")}
                type="number"
                {...register("automatic_completion_number_of_exercises_attempted_treshold", {
                  valueAsNumber: true,
                  disabled: !isChecked,
                })}
                error={errors["name"]?.message}
              />
              {/* Only for default module */}
              {!module.name && (
                <div
                  className={css`
                    flex: 1;
                  `}
                >
                  <Checkbox
                    label={t("automatic-completion-requires-exam")}
                    {...register("automatic_completion_requires_exam", {
                      disabled: !isChecked,
                    })}
                    className={css`
                      margin-bottom: 0;
                      position: relative;
                      top: 10px;
                    `}
                  />
                </div>
              )}
            </div>
            <div
              className={css`
                margin-top: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <Checkbox
                label={t("override-completion-registration-link")}
                {...register("override_completion_link")}
              />
              <TextField
                label={t("completion-registration-link")}
                placeholder={t("completion-registration-link")}
                className={css`
                  margin-bottom: 0;
                `}
                {...register("completion_registration_link_override", {
                  disabled: !overrideLink,
                  minLength: 10,
                })}
                error={errors["completion_registration_link_override"]?.message}
              />
            </div>
            <Checkbox
              label={t("label-enable-registering-completion-to-uh-open-university")}
              {...register("enable_registering_completion_to_uh_open_university")}
            />
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                justify-content: left;
                column-gap: 1rem;
                margin-bottom: 1.4rem;
                ${respondToOrLarger.md} {
                  align-items: flex-end;
                  flex-direction: row;
                }
              `}
            >
              <TextField
                className={css`
                  flex: 1;
                  min-width: 8rem;
                  margin-bottom: 0;
                `}
                label={t("uh-course-code")}
                placeholder={t("uh-course-code")}
                {...register("uh_course_code")}
                error={errors["name"]?.message}
              />
              <TextField
                className={css`
                  flex: 1;
                  min-width: 8rem;
                  margin-bottom: 0;
                `}
                label={t("ects-credits")}
                placeholder={t("ects-credits")}
                type="number"
                // eslint-disable-next-line i18next/no-literal-string
                step="any"
                {...register("ects_credits", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
        )}
        <div
          className={css`
            display: flex;

            button {
              margin-right: 1rem;
            }
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          />
          {active ? (
            <>
              <Button
                aria-label={t("confirm")}
                className={css`
                  display: flex !important;
                  padding: 0 !important;
                  justify-content: center;
                  align-items: center;
                  height: 2rem;
                  width: 2rem;
                  background: #e1e3e5 !important;
                  border-radius: 100%;
                `}
                disabled={!isValid || isSubmitting}
                type={"submit"}
                variant={"icon"}
                size={"small"}
              >
                <CheckCircle
                  size={20}
                  className={css`
                    color: #1a2333;
                  `}
                />
              </Button>
              <Button
                aria-label={t("button-text-cancel")}
                className={css`
                  display: flex !important;
                  padding: 0 !important;
                  justify-content: center;
                  align-items: center;
                  height: 2rem;
                  width: 2rem;
                  background: #e1e3e5 !important;
                  border-radius: 100%;
                  margin-bottom: 1rem;
                `}
                onClick={() => {
                  setActive(false)
                  reset()
                }}
                disabled={isSubmitting}
                variant={"icon"}
                size={"small"}
              >
                <XmarkCircle size={20} />
              </Button>
            </>
          ) : (
            <Button
              aria-label={t("edit")}
              className={css`
                border-radius: 100%;
                height: 2rem;
                width: 2rem;
                background: #e1e3e5 !important;
              `}
              onClick={() => setActive(true)}
              variant={"icon"}
              size={"small"}
            >
              <Pencil size={14} color={"#313947"} />
            </Button>
          )}
          {module.name !== null && (
            <Button
              aria-label={t("button-text-delete")}
              className={css`
                height: 2rem;
                width: 2rem;
                background: #fbeef0 !important;
                border-radius: 100%;
                display: flex !important;
                padding: 0 !important;
                align-items: center;
                justify-content: center;
              `}
              onClick={() => onDeleteModule(module.id)}
              disabled={isSubmitting}
              variant={"icon"}
              size={"small"}
            >
              <Trash size={16} color={"#D85762"} />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

export default EditCourseModuleForm
