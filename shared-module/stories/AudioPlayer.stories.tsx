/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import AudioPlayer from "../src/components/AudioPlayer"

export default {
  title: "Components/AudioPlayer",
  component: AudioPlayer,
} as Meta

const Component = AudioPlayer

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Audio: Story<ComponentProps> = Template.bind({})
Audio.args = {}
