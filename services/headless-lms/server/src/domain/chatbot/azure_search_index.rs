use crate::prelude::*;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewIndex {
    name: String,
    fields: Vec<Field>,
    scoring_profiles: Vec<ScoringProfile>,
    default_scoring_profile: String,
    suggesters: Vec<Suggester>,
    analyzers: Vec<Analyzer>,
    cors_options: CorsOptions,
    encryption_key: Option<EncryptionKey>,
    similarity: Similarity,
    semantic: Semantic,
    vector_search: VectorSearch,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Analyzer {
    name: String,
    #[serde(rename = "@odata.type")]
    odata_type: String,
    char_filters: Vec<String>,
    tokenizer: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorsOptions {
    allowed_origins: Vec<String>,
    max_age_in_seconds: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptionKey {
    key_vault_key_name: String,
    key_vault_key_version: String,
    key_vault_uri: String,
    access_credentials: AccessCredentials,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessCredentials {
    application_id: String,
    application_secret: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    name: String,
    #[serde(rename = "type")]
    field_type: String,
    key: Option<bool>,
    searchable: Option<bool>,
    filterable: Option<bool>,
    sortable: Option<bool>,
    facetable: Option<bool>,
    retrievable: Option<bool>,
    index_analyzer: Option<serde_json::Value>,
    search_analyzer: Option<serde_json::Value>,
    analyzer: Option<String>,
    synonym_maps: Option<Vec<Option<serde_json::Value>>>,
    dimensions: Option<i64>,
    vector_search_profile: Option<String>,
    stored: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct ScoringProfile {
    name: String,
    text: Text,
    functions: Vec<Function>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Function {
    #[serde(rename = "type")]
    function_type: String,
    boost: i64,
    field_name: String,
    interpolation: String,
    distance: Distance,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Distance {
    reference_point_parameter: String,
    boosting_distance: i64,
}

#[derive(Serialize, Deserialize)]
pub struct Text {
    weights: Weights,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Weights {
    hotel_name: i64,
}

#[derive(Serialize, Deserialize)]
pub struct Semantic {
    configurations: Vec<SemanticConfiguration>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticConfiguration {
    name: String,
    prioritized_fields: SemanticConfigurationPrioritizedFields,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticConfigurationPrioritizedFields {
    title_field: FieldDescriptor,
    prioritized_content_fields: Vec<FieldDescriptor>,
    prioritized_keywords_fields: Vec<FieldDescriptor>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDescriptor {
    field_name: String,
}

#[derive(Serialize, Deserialize)]
pub struct Similarity {
    #[serde(rename = "@odata.type")]
    odata_type: String,
    b: f64,
    k1: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggester {
    name: String,
    search_mode: String,
    source_fields: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VectorSearch {
    profiles: Vec<Profile>,
    algorithms: Vec<Algorithm>,
    compressions: Vec<Compression>,
    vectorizers: Vec<Vectorizer>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vectorizer {
    name: String,
    kind: String,
    #[serde(rename = "azureOpenAIParameters")]
    azure_open_ai_parameters: AzureOpenAiParameters,
    custom_web_api_parameters: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureOpenAiParameters {
    resource_uri: String,
    deployment_id: String,
    api_key: String,
    model_name: String,
    auth_identity: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Algorithm {
    name: String,
    kind: String,
    hnsw_parameters: Option<HnswParameters>,
    exhaustive_knn_parameters: Option<ExhaustiveKnnParameters>,
}

#[derive(Serialize, Deserialize)]
pub struct ExhaustiveKnnParameters {
    metric: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HnswParameters {
    m: i64,
    metric: String,
    ef_construction: i64,
    ef_search: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Compression {
    name: String,
    kind: String,
    scalar_quantization_parameters: Option<ScalarQuantizationParameters>,
    rerank_with_original_vectors: bool,
    default_oversampling: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScalarQuantizationParameters {
    quantized_data_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct Profile {
    name: String,
    algorithm: String,
    compression: Option<String>,
    vectorizer: Option<String>,
}

pub async fn get_search_index(
    index_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let index = todo!();
    Ok(())
}

pub async fn create_search_index(
    index_name: String,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let index = NewIndex {
        name: index_name.clone(),
        fields: vec![],
        scoring_profiles: vec![],
        default_scoring_profile: String::new(),
        suggesters: vec![],
        analyzers: vec![],
        cors_options: CorsOptions {
            allowed_origins: vec![],
            max_age_in_seconds: 0,
        },
        encryption_key: None,
        similarity: Similarity {
            odata_type: String::new(),
            b: 0.0,
            k1: 0.0,
        },
        semantic: Semantic {
            configurations: vec![SemanticConfiguration {
                name: index_name.clone(),
                prioritized_fields: SemanticConfigurationPrioritizedFields {
                    title_field: FieldDescriptor {
                        field_name: "title".to_string(),
                    },
                    prioritized_content_fields: vec![FieldDescriptor {
                        field_name: "chunk".to_string(),
                    }],
                    prioritized_keywords_fields: vec![],
                },
            }],
        },
        vector_search: VectorSearch {
            profiles: vec![Profile {
                name: index_name.clone(),
                algorithm: index_name.clone(),
                vectorizer: Some(index_name.clone()),
                compression: None,
            }],
            algorithms: vec![Algorithm {
                name: index_name.clone(),
                kind: "hnsw".to_string(),
                hnsw_parameters: Some(HnswParameters {
                    m: 16,
                    metric: "cosine".to_string(),
                    ef_construction: 4,
                    ef_search: 500,
                }),
                exhaustive_knn_parameters: None,
            }],
            vectorizers: vec![Vectorizer {
                name: index_name.clone(),
                kind: "azureOpenAI".to_string(),
                azure_open_ai_parameters: AzureOpenAiParameters {
                    // TODO: read from env
                    resource_uri: String::new(),
                    deployment_id: String::new(),
                    api_key: String::new(),
                    model_name: String::new(),
                    auth_identity: None,
                },
                custom_web_api_parameters: None,
            }],
            compressions: vec![],
        },
    };
    Ok(())
}
