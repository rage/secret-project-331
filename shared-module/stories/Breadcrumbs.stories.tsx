/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Breadcrumbs from "../src/components/Breadcrumbs"

const Component = Breadcrumbs

export default {
  title: "Components/Navigation/Breadcrumbs",
  component: Component,
} as Meta

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Default: Story<ComponentProps> = Template.bind({})
Default.args = {
  pieces: [
    { text: "Home", url: "/" },
    { text: "Courses", url: "/courses" },
    { text: "Introduction to Everything", url: "/courses/x" },
    { text: "Stats", url: "/courses/x/stats" },
  ],
}
