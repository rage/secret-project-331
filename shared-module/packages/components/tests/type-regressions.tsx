"use client"

import React from "react"
import type { Control } from "react-hook-form"

import { Radio, Switch, TextArea, TextField } from "../src"

type Form = { text: string; notes: string; enabled: boolean }
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
