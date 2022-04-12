/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Timeline from "../src/components/Timeline"

const data = [
  {
    value: "The UN Conference on Environment and Development (UNCED), Rio de Janeiro",
    label: "The UN Conference on Environment and Development (UNCED), Rio de Janeiro",
  },
  {
    value: "The establishment of the UN Commission on Sustainable Development",
    label: "The establishment of the UN Commission on Sustainable Development",
  },
  {
    value: "The World Summit on Sustainable Development (WSSD), Johannesburg",
    label: "The World Summit on Sustainable Development (WSSD), Johannesburg",
  },
  { value: "Rio +5 conference, New York", label: "Rio +5 conference, New York" },
  {
    value:
      "UN 2030 Agenda for Sustainable Development is accepted & Sustainable Development Goals introducede",
    label:
      "UN 2030 Agenda for Sustainable Development is accepted & Sustainable Development Goals introduced",
  },
  { value: "The New York Summit", label: "The New York Summit" },
  { value: "Our Common Future report published", label: "Our Common Future report published" },
  {
    value: "The establishment of the United Nations Environment Programme (UNEP)",
    label: "The establishment of the United Nations Environment Programme (UNEP)",
  },
]

export default {
  title: "Components/Timeline",
  component: Timeline,
} as Meta

const Component = Timeline

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => (
  <Component {...args} data={data} />
)

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Timeline",
}
