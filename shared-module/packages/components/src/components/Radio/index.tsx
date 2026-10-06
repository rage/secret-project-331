"use client"

import React, { useContext } from "react"

import { RadioGroupContext } from "../RadioGroup"
import { RadioInGroup } from "./RadioInGroup"
import { RadioStandalone } from "./RadioStandalone"
import type { RadioProps } from "./radioTypes"

export type { RadioProps } from "./radioTypes"

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  function Radio(props, forwardedRef) {
    const group = useContext(RadioGroupContext)

    if (group) {
      return <RadioInGroup {...props} forwardedRef={forwardedRef} group={group} />
    }

    return <RadioStandalone {...props} forwardedRef={forwardedRef} />
  },
)
