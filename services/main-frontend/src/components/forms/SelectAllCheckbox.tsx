"use client"

import React, { useEffect } from "react"
import { useForm } from "react-hook-form"

import { Checkbox } from "@/shared-module/components"

interface SelectAllCheckboxProps {
  label: React.ReactNode
  isAllSelected: boolean
  onToggleAll: (selected: boolean) => void
  className?: string
}

/** A checkbox that mirrors whether every item of a group is selected and sets them all when toggled. */
const SelectAllCheckbox: React.FC<SelectAllCheckboxProps> = ({
  label,
  isAllSelected,
  onToggleAll,
  className,
}) => {
  const { control, watch, setValue } = useForm<{ all: boolean }>({
    defaultValues: { all: isAllSelected },
  })
  const all = watch("all")

  useEffect(() => {
    setValue("all", isAllSelected)
  }, [isAllSelected, setValue])

  useEffect(() => {
    if (all !== isAllSelected) {
      onToggleAll(all)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [all])

  return (
    <Checkbox name="all" control={control} label={label} {...(className ? { className } : {})} />
  )
}

export default SelectAllCheckbox
