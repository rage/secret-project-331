import { useEffect, useState, Fragment } from '@wordpress/element';
import {
	BlockEditorKeyboardShortcuts,
	BlockEditorProvider,
	BlockList,
	BlockInspector,
	WritingFlow,
	ObserveTyping,
	InspectorControls,
} from '@wordpress/block-editor';
import { useBlockProps } from '@wordpress/block-editor';
import {
	Popover,
	SlotFillProvider,
	DropZoneProvider,
	TextControl,
	ToggleControl,
	Panel,
	PanelBody,
	PanelRow
} from '@wordpress/components';
import { registerCoreBlocks } from '@wordpress/block-library';
import { registerBlockType } from "@wordpress/blocks"
import '@wordpress/block-editor/build-style/style.css'
import '@wordpress/components/build-style/style.css'
import '@wordpress/format-library'
import { ProgrammingExercise } from "moocfi-python-editor"

function Editor() {
	const [ blocks, updateBlocks ] = useState( [] );

	useEffect( () => {
		registerCoreBlocks();
		registerBlockType("exercise/programming-exercise", {
			title: "Programming exercise",
			description: "In browser programming exericse",
			category: "embed",
			attributes: {
				"exercise-name": {
					type: "string",
				}
			},
			edit: (props) => {
				const blockProps = useBlockProps( { className: 'my-random-classname' } );
		 
				return <div { ...blockProps }>
					<Fragment>
						<InspectorControls>
							<PanelBody>
								<PanelRow>
									<TextControl 
										label="Exercise name"
										onChange={
											(val) => {
												props.setAttributes({"exercise-name": val})
											}
										}
										value={props.attributes['exercise-name']}
									/>
								</PanelRow>
								
							</PanelBody>
							<ProgrammingExercise
								onExerciseDetailsChange={() => {}}
								organization={"test"}
								course={"python-random-testcourse"}
								exercise={props.attributes['exercise-name']}
								token={"asd"}
								height={"300px"}
								outputHeight={"auto"}
								outputPosition={"relative"}
								language={"fi"}
							/>
						</InspectorControls>
					</Fragment>
			  	</div>;
			},
			save: () => {
				const blockProps = useBlockProps.save();
			 
				return <div { ...blockProps }>Your block.</div>;
			}
		})
	}, [] );

	return (
		<div className="playground">
			<SlotFillProvider>
				<DropZoneProvider>
					<BlockEditorProvider
						value={ blocks }
						onInput={ updateBlocks }
						onChange={ updateBlocks }
					>
						<div className="playground__sidebar">
							<BlockInspector />
						</div>
						<div className="editor-styles-wrapper">
							<Popover.Slot name="block-toolbar" />
							<BlockEditorKeyboardShortcuts />
							<WritingFlow>
								<ObserveTyping>
									<BlockList />
								</ObserveTyping>
							</WritingFlow>
						</div>
						<Popover.Slot />
					</BlockEditorProvider>
				</DropZoneProvider>
			</SlotFillProvider>
		</div>
	);
}

export default Editor
