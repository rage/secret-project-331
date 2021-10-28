/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import DebugModal from "../src/components/DebugModal"

export default {
  title: "Components/DebugModal",
  component: DebugModal,
} as Meta

const Component = DebugModal

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  data: {
    random: 12,
    "random float": 1.768,
    bool: false,
    date: "2001-01-01",
    regEx: "hellooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo world",
    enum: "json",
    firstname: "Firstname",
    lastname: "LastName",
    city: "Stockholm",
    country: "Belize",
    countryCode: "US",
    "email uses current data": "firstname.lastname@example.com",
    "email from expression": "Firstname.Lastname@example.com",
    array: ["Lanna", "Marinna", "Constance", "Konstance", "Stevana"],
    "array of objects": [
      {
        index: 0,
        "index start at 5": 5,
      },
      {
        index: 1,
        "index start at 5": 6,
      },
      {
        index: 2,
        "index start at 5": 7,
      },
    ],
    Emelina: {
      age: 32,
    },
  },
}
