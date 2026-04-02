"use client"

import React from "react"

import { Radio, Switch, TextArea, TextField } from "../src"

void React.createElement(TextField, { label: "Name", value: "Ada" })
void React.createElement(TextField, { label: "Name", defaultValue: "Ada" })
// @ts-expect-error TextField values are string-only.
void React.createElement(TextField, { label: "Name", value: 0 })
// @ts-expect-error TextField default values are string-only.
void React.createElement(TextField, { label: "Name", defaultValue: 0 })

void React.createElement(TextArea, { label: "Notes", value: "Ready" })
void React.createElement(TextArea, { label: "Notes", defaultValue: "Ready" })
// @ts-expect-error TextArea values are string-only.
void React.createElement(TextArea, { label: "Notes", value: 0 })
// @ts-expect-error TextArea default values are string-only.
void React.createElement(TextArea, { label: "Notes", defaultValue: 0 })

void React.createElement(Switch, { label: "Enabled" })
// @ts-expect-error Switch always renders a checkbox input.
void React.createElement(Switch, { label: "Enabled", type: "text" })

void React.createElement(Radio, { label: "Choice", value: "a" })
// @ts-expect-error Radio always renders a radio input.
void React.createElement(Radio, { label: "Choice", value: "a", type: "text" })
