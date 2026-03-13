use crate::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum ParagraphSuggestionAction {
    #[serde(rename = "moocfi/ai/generate-draft-from-notes")]
    GenerateDraftFromNotes,
    #[serde(rename = "moocfi/ai/generate-continue-paragraph")]
    GenerateContinueParagraph,
    #[serde(rename = "moocfi/ai/generate-add-example")]
    GenerateAddExample,
    #[serde(rename = "moocfi/ai/generate-add-counterpoint")]
    GenerateAddCounterpoint,
    #[serde(rename = "moocfi/ai/generate-add-concluding-sentence")]
    GenerateAddConcludingSentence,
    #[serde(rename = "moocfi/fix-spelling")]
    FixSpelling,
    #[serde(rename = "moocfi/ai/improve-clarity")]
    ImproveClarity,
    #[serde(rename = "moocfi/ai/improve-flow")]
    ImproveFlow,
    #[serde(rename = "moocfi/ai/improve-concise")]
    ImproveConcise,
    #[serde(rename = "moocfi/ai/improve-expand-detail")]
    ImproveExpandDetail,
    #[serde(rename = "moocfi/ai/improve-academic-style")]
    ImproveAcademicStyle,
    #[serde(rename = "moocfi/ai/structure-create-topic-sentence")]
    StructureCreateTopicSentence,
    #[serde(rename = "moocfi/ai/structure-reorder-sentences")]
    StructureReorderSentences,
    #[serde(rename = "moocfi/ai/structure-split-into-paragraphs")]
    StructureSplitIntoParagraphs,
    #[serde(rename = "moocfi/ai/structure-combine-into-one")]
    StructureCombineIntoOne,
    #[serde(rename = "moocfi/ai/structure-to-bullets")]
    StructureToBullets,
    #[serde(rename = "moocfi/ai/structure-from-bullets")]
    StructureFromBullets,
    #[serde(rename = "moocfi/ai/learning-simplify-beginners")]
    LearningSimplifyBeginners,
    #[serde(rename = "moocfi/ai/learning-add-definitions")]
    LearningAddDefinitions,
    #[serde(rename = "moocfi/ai/learning-add-analogy")]
    LearningAddAnalogy,
    #[serde(rename = "moocfi/ai/learning-add-practice-question")]
    LearningAddPracticeQuestion,
    #[serde(rename = "moocfi/ai/learning-add-check-understanding")]
    LearningAddCheckUnderstanding,
    #[serde(rename = "moocfi/ai/summaries-one-sentence")]
    SummariesOneSentence,
    #[serde(rename = "moocfi/ai/summaries-two-three-sentences")]
    SummariesTwoThreeSentences,
    #[serde(rename = "moocfi/ai/summaries-key-takeaway")]
    SummariesKeyTakeaway,
    #[serde(rename = "moocfi/ai/tone-academic-formal")]
    ToneAcademicFormal,
    #[serde(rename = "moocfi/ai/tone-friendly-conversational")]
    ToneFriendlyConversational,
    #[serde(rename = "moocfi/ai/tone-encouraging-supportive")]
    ToneEncouragingSupportive,
    #[serde(rename = "moocfi/ai/tone-neutral-objective")]
    ToneNeutralObjective,
    #[serde(rename = "moocfi/ai/tone-confident")]
    ToneConfident,
    #[serde(rename = "moocfi/ai/tone-serious")]
    ToneSerious,
    #[serde(rename = "moocfi/ai/translate-english")]
    TranslateEnglish,
    #[serde(rename = "moocfi/ai/translate-finnish")]
    TranslateFinnish,
    #[serde(rename = "moocfi/ai/translate-norwegian")]
    TranslateNorwegian,
    #[serde(rename = "moocfi/ai/translate-swedish")]
    TranslateSwedish,
}

impl ParagraphSuggestionAction {
    /// Returns the API string value for this action.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::GenerateDraftFromNotes => "moocfi/ai/generate-draft-from-notes",
            Self::GenerateContinueParagraph => "moocfi/ai/generate-continue-paragraph",
            Self::GenerateAddExample => "moocfi/ai/generate-add-example",
            Self::GenerateAddCounterpoint => "moocfi/ai/generate-add-counterpoint",
            Self::GenerateAddConcludingSentence => "moocfi/ai/generate-add-concluding-sentence",
            Self::FixSpelling => "moocfi/fix-spelling",
            Self::ImproveClarity => "moocfi/ai/improve-clarity",
            Self::ImproveFlow => "moocfi/ai/improve-flow",
            Self::ImproveConcise => "moocfi/ai/improve-concise",
            Self::ImproveExpandDetail => "moocfi/ai/improve-expand-detail",
            Self::ImproveAcademicStyle => "moocfi/ai/improve-academic-style",
            Self::StructureCreateTopicSentence => "moocfi/ai/structure-create-topic-sentence",
            Self::StructureReorderSentences => "moocfi/ai/structure-reorder-sentences",
            Self::StructureSplitIntoParagraphs => "moocfi/ai/structure-split-into-paragraphs",
            Self::StructureCombineIntoOne => "moocfi/ai/structure-combine-into-one",
            Self::StructureToBullets => "moocfi/ai/structure-to-bullets",
            Self::StructureFromBullets => "moocfi/ai/structure-from-bullets",
            Self::LearningSimplifyBeginners => "moocfi/ai/learning-simplify-beginners",
            Self::LearningAddDefinitions => "moocfi/ai/learning-add-definitions",
            Self::LearningAddAnalogy => "moocfi/ai/learning-add-analogy",
            Self::LearningAddPracticeQuestion => "moocfi/ai/learning-add-practice-question",
            Self::LearningAddCheckUnderstanding => "moocfi/ai/learning-add-check-understanding",
            Self::SummariesOneSentence => "moocfi/ai/summaries-one-sentence",
            Self::SummariesTwoThreeSentences => "moocfi/ai/summaries-two-three-sentences",
            Self::SummariesKeyTakeaway => "moocfi/ai/summaries-key-takeaway",
            Self::ToneAcademicFormal => "moocfi/ai/tone-academic-formal",
            Self::ToneFriendlyConversational => "moocfi/ai/tone-friendly-conversational",
            Self::ToneEncouragingSupportive => "moocfi/ai/tone-encouraging-supportive",
            Self::ToneNeutralObjective => "moocfi/ai/tone-neutral-objective",
            Self::ToneConfident => "moocfi/ai/tone-confident",
            Self::ToneSerious => "moocfi/ai/tone-serious",
            Self::TranslateEnglish => "moocfi/ai/translate-english",
            Self::TranslateFinnish => "moocfi/ai/translate-finnish",
            Self::TranslateNorwegian => "moocfi/ai/translate-norwegian",
            Self::TranslateSwedish => "moocfi/ai/translate-swedish",
        }
    }
}
