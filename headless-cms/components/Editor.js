import { useEffect, useState } from '@wordpress/element';
import {
	BlockEditorKeyboardShortcuts,
	BlockEditorProvider,
	BlockList,
	BlockInspector,
	WritingFlow,
	ObserveTyping,
} from '@wordpress/block-editor';
import { useBlockProps } from '@wordpress/block-editor';
import {
	Popover,
	SlotFillProvider,
	DropZoneProvider,
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
		registerBlockType("jori/test", {
			title: "Hello",
			description: "World",
			category: "embed",
			attributes: {
				name: {
					type: "string",
				}
			},
			edit: () => {
				const blockProps = useBlockProps( { className: 'my-random-classname' } );
		 
				return <div { ...blockProps }>
					<ProgrammingExercise
						onExerciseDetailsChange={() => {}}
						organization={"test"}
						course={"python-random-testcourse"}
						exercise={"osa01-01_hymio"}
						token={"asd"}
						height={"300px"}
						outputHeight={"auto"}
						outputPosition={"relative"}
						language={"fi"}
					/>
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
