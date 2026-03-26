"use client"

import React, { useContext } from "react"

import { RadioGroupContext } from "../RadioGroup"

import { GroupedRadio } from "./GroupedRadio"
import { StandaloneRadio } from "./StandaloneRadio"
import type { RadioProps } from "./radioTypes"

export type { RadioProps } from "./radioTypes"

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  function Radio(props, forwardedRef) {
    const group = useContext(RadioGroupContext)

    if (group) {
      return <GroupedRadio {...props} forwardedRef={forwardedRef} group={group} />
    }

    return <StandaloneRadio {...props} forwardedRef={forwardedRef} />
  },
)
