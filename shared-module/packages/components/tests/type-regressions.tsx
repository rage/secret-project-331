"use client"

import React from "react"
import type { Control } from "react-hook-form"

import type { DialogApi } from "../src"
import { Radio, Slider, Switch, TextArea, TextField } from "../src"

interface Form {
  text: string
  notes: string
  enabled: boolean
  points: number
}
const control = null as unknown as Control<Form>

void React.createElement(TextField<Form>, {
  name: "text",
  control,
  label: "Name",
})
// @ts-expect-error TextField requires RHF wiring.
void React.createElement(TextField<Form>, { label: "Name" })

void React.createElement(TextArea<Form>, {
  name: "notes",
  control,
  label: "Notes",
})
// @ts-expect-error TextArea requires RHF wiring.
void React.createElement(TextArea<Form>, { label: "Notes" })

void React.createElement(Switch<Form>, { name: "enabled", control, label: "Enabled" })
void React.createElement(Switch<Form>, { name: "enabled", control, label: "Enabled" })
// @ts-expect-error Switch always renders a checkbox input.
void React.createElement(Switch<Form>, { name: "enabled", control, label: "Enabled", type: "text" })

void React.createElement(Radio, { label: "Choice", value: "a" })
// @ts-expect-error Radio always renders a radio input.
void React.createElement(Radio, { label: "Choice", value: "a", type: "text" })

void React.createElement(Slider<Form>, { name: "points", control, label: "Points", maxValue: 10 })
// @ts-expect-error Slider requires RHF wiring.
void React.createElement(Slider<Form>, { label: "Points", maxValue: 10 })
// @ts-expect-error Slider requires a maxValue.
void React.createElement(Slider<Form>, { name: "points", control, label: "Points" })

const dialog = null as unknown as DialogApi
const QUESTION = "End the exam?"
const NOTICE = "Saving failed"
const ACKNOWLEDGE = "Got it"
const FIELD_QUESTION = "New name"
const FIELD_DEFAULT = "Chapter 1"
const PICK = "Pick"

async function dialogRequestsAndResults() {
  const answer: boolean = await dialog.confirm(QUESTION)
  void answer
  await dialog.alert({ message: NOTICE, acknowledgeLabel: ACKNOWLEDGE })

  // @ts-expect-error prompt has no string shorthand; it takes a request object.
  await dialog.prompt(FIELD_QUESTION)

  const text = await dialog.prompt({ message: FIELD_QUESTION, defaultValue: FIELD_DEFAULT })
  // @ts-expect-error A prompt result carries no value until it is narrowed to submitted.
  void text.value
  if (text.isSubmitted) {
    const value: string = text.value
    void value
  }

  const picked = await dialog.prompt<number>({ message: PICK, body: () => null })
  if (picked.isSubmitted) {
    const value: number = picked.value
    void value
  }
}
void dialogRequestsAndResults
