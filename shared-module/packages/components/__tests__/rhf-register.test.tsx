"use client"

import { fireEvent, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"

import { Checkbox } from "../src/components/Checkbox"
import { Select } from "../src/components/Select"
import { Switch } from "../src/components/Switch"
import { TextArea } from "../src/components/TextArea"
import { TextField } from "../src/components/TextField"

import { renderUi } from "./testUtils"

function RegisterForm() {
  const { handleSubmit, register, reset } = useForm({
    defaultValues: {
      name: "Ada",
      bio: "Hello",
      terms: true,
      notif: false,
      role: "teacher",
    },
  })

  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <TextField label="Name" {...register("name", { required: true, minLength: 3 })} />
      <TextArea label="Bio" {...register("bio")} />
      <Checkbox label="Terms" {...register("terms")} />
      <Switch label="Notif" {...register("notif")} />
      <Select
        label="Role"
        options={[
          { label: "Teacher", value: "teacher" },
          { label: "Student", value: "student" },
        ]}
        {...register("role")}
      />
      <button type="button" onClick={() => reset()}>
        Reset
      </button>
      <button type="submit">Submit</button>
    </form>
  )
}

describe("react-hook-form register integration", () => {
  test("wires register fields for uncontrolled editing", () => {
    renderUi(<RegisterForm />)

    const name = screen.getByRole("textbox", { name: "Name" })
    const bio = screen.getByRole("textbox", { name: "Bio" })
    const terms = screen.getByRole("checkbox", { name: "Terms" })

    fireEvent.change(name, { target: { value: "Grace" } })
    fireEvent.change(bio, { target: { value: "Hi" } })
    fireEvent.click(terms)

    expect(name).toHaveValue("Grace")
    expect(bio).toHaveValue("Hi")
    expect(terms).toBeInTheDocument()
  })

  test("reset restores defaults", () => {
    renderUi(<RegisterForm />)
    const name = screen.getByRole("textbox", { name: "Name" })
    fireEvent.change(name, { target: { value: "Changed" } })
    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    expect(name).toHaveValue("Ada")
  })
})
