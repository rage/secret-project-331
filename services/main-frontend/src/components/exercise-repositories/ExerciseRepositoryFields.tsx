"use client"

import React from "react"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { TextArea, TextField } from "@/shared-module/components"

export interface ExerciseRepositoryFieldValues {
  url: string
  branch: string
  publicKey: string
  deployKey: string
}

export const EMPTY_EXERCISE_REPOSITORY_FIELDS: ExerciseRepositoryFieldValues = {
  url: "",
  branch: "",
  publicKey: "",
  deployKey: "",
}

/**
 * The request body fields both the create and the update endpoint take. A blank deploy key is
 * none (on update: keep the stored one), and a public key goes only with a deploy key.
 */
export function toRepositoryBody(fields: ExerciseRepositoryFieldValues) {
  const branch = fields.branch.trim()
  const hasDeployKey = fields.deployKey.trim().length > 0
  const publicKey = fields.publicKey.trim()
  return {
    url: fields.url.trim(),
    branch: branch.length > 0 ? branch : null,
    deploy_key: hasDeployKey ? fields.deployKey : null,
    public_key: hasDeployKey && publicKey.length > 0 ? publicKey : null,
  }
}

interface Props {
  control: Control<ExerciseRepositoryFieldValues>
  deployKeyLabel: string
}

const ExerciseRepositoryFields: React.FC<Props> = ({ control, deployKeyLabel }) => {
  const { t } = useTranslation()
  return (
    <>
      <TextField
        name="url"
        control={control}
        label={t("exercise-repositories-git-url")}
        rules={{ required: t("required-field") }}
      />
      <TextField name="branch" control={control} label={t("exercise-repositories-branch")} />
      <TextArea name="publicKey" control={control} label={t("public-key")} />
      <TextArea name="deployKey" control={control} label={deployKeyLabel} />
    </>
  )
}

export default ExerciseRepositoryFields
