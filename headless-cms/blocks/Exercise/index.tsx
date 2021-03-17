import { BlockConfiguration } from '@wordpress/blocks'
import ExerciseEditor from './ExerciseEditor'
import ExerciseSave from './ExerciseSave'

const ExerciseConfiguration: BlockConfiguration<{ exercise_id: string }> = {
  title: 'Exercise Iframe',
  description: 'Exercise with iframe',
  category: 'embed',
  attributes: {
    exercise_id: {
      type: 'string',
      default: '',
    },
  },
  edit: ExerciseEditor,
  save: ExerciseSave,
}

export default ExerciseConfiguration
