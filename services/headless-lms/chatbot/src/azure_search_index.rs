use crate::prelude::*;
use headless_lms_utils::{http::REQWEST_CLIENT, ApplicationConfiguration};

const API_VERSION: &str = "2024-07-01";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewIndex {
    name: String,
    fields: Vec<Field>,
    scoring_profiles: Vec<ScoringProfile>,
    default_scoring_profile: Option<String>,
    suggesters: Vec<Suggester>,
    analyzers: Vec<Analyzer>,
    tokenizers: Vec<serde_json::Value>,
    token_filters: Vec<serde_json::Value>,
    char_filters: Vec<serde_json::Value>,
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
    index_analyzer: Option<String>,
    search_analyzer: Option<String>,
    analyzer: Option<String>,
    synonym_maps: Option<Vec<String>>,
    dimensions: Option<i64>,
    vector_search_profile: Option<String>,
    stored: Option<bool>,
    vector_encoding: Option<serde_json::Value>,
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
#[serde(rename_all = "camelCase")]
pub struct Semantic {
    default_configuration: String,
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
    b: Option<f64>,
    k1: Option<f64>,
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

pub async fn does_search_index_exist(
    index_name: &str,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<bool> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("indexes('{}')", index_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let response = REQWEST_CLIENT
        .get(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .send()
        .await?;

    if response.status().is_success() {
        Ok(true)
    } else if response.status() == 404 {
        Ok(false)
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Error checking if index exists. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

pub async fn create_search_index(
    index_name: String,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()> {
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let fields = vec![
        Field {
            name: "chunk_id".to_string(),
            field_type: "Edm.String".to_string(),
            key: Some(true),
            searchable: Some(true),
            filterable: Some(true),
            retrievable: Some(true),
            stored: Some(true),
            sortable: Some(true),
            facetable: Some(true),
            analyzer: Some("keyword".to_string()),
            index_analyzer: None,
            search_analyzer: None,
            synonym_maps: Some(vec![]),
            dimensions: None,
            vector_search_profile: None,
            vector_encoding: None,
        },
        Field {
            name: "parent_id".to_string(),
            field_type: "Edm.String".to_string(),
            key: Some(false),
            searchable: Some(true),
            filterable: Some(true),
            retrievable: Some(true),
            stored: Some(true),
            sortable: Some(true),
            facetable: Some(true),
            analyzer: None,
            index_analyzer: None,
            search_analyzer: None,
            synonym_maps: Some(vec![]),
            dimensions: None,
            vector_search_profile: None,
            vector_encoding: None,
        },
        Field {
            name: "chunk".to_string(),
            field_type: "Edm.String".to_string(),
            key: Some(false),
            searchable: Some(true),
            filterable: Some(false),
            retrievable: Some(true),
            stored: Some(true),
            sortable: Some(false),
            facetable: Some(false),
            analyzer: None,
            index_analyzer: None,
            search_analyzer: None,
            synonym_maps: Some(vec![]),
            dimensions: None,
            vector_search_profile: None,
            vector_encoding: None,
        },
        Field {
            name: "title".to_string(),
            field_type: "Edm.String".to_string(),
            key: Some(false),
            searchable: Some(true),
            filterable: Some(true),
            retrievable: Some(true),
            stored: Some(true),
            sortable: Some(false),
            facetable: Some(false),
            analyzer: None,
            index_analyzer: None,
            search_analyzer: None,
            synonym_maps: Some(vec![]),
            dimensions: None,
            vector_search_profile: None,
            vector_encoding: None,
        },
        Field {
            name: "url".to_string(),
            field_type: "Edm.String".to_string(),
            key: Some(false),
            searchable: Some(false),
            filterable: Some(true),
            retrievable: Some(true),
            stored: Some(true),
            sortable: Some(false),
            facetable: Some(false),
            analyzer: None,
            index_analyzer: None,
            search_analyzer: None,
            synonym_maps: Some(vec![]),
            dimensions: None,
            vector_search_profile: None,
            vector_encoding: None,
        },
        Field {
            name: "text_vector".to_string(),
            field_type: "Collection(Edm.Single)".to_string(),
            key: Some(false),
            searchable: Some(true),
            filterable: Some(false),
            retrievable: Some(true),
            stored: Some(true),
            sortable: Some(false),
            facetable: Some(false),
            analyzer: None,
            index_analyzer: None,
            search_analyzer: None,
            synonym_maps: Some(vec![]),
            dimensions: Some(1536),
            vector_search_profile: Some(format!("{}-azureOpenAi-text-profile", index_name)),
            vector_encoding: None,
        },
    ];

    let index = NewIndex {
        name: index_name.clone(),
        fields,
        scoring_profiles: vec![],
        default_scoring_profile: None,
        suggesters: vec![],
        analyzers: vec![],
        tokenizers: vec![],
        token_filters: vec![],
        char_filters: vec![],
        cors_options: CorsOptions {
            allowed_origins: vec!["*".to_string()],
            max_age_in_seconds: 300,
        },
        encryption_key: None,
        similarity: Similarity {
            odata_type: "#Microsoft.Azure.Search.BM25Similarity".to_string(),
            b: None,
            k1: None,
        },
        semantic: Semantic {
            default_configuration: format!("{}-semantic-configuration", index_name),
            configurations: vec![SemanticConfiguration {
                name: format!("{}-semantic-configuration", index_name),
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
                name: format!("{}-azureOpenAi-text-profile", index_name),
                algorithm: format!("{}-algorithm", index_name),
                vectorizer: Some(format!("{}-azureOpenAi-text-vectorizer", index_name)),
                compression: None,
            }],
            algorithms: vec![Algorithm {
                name: format!("{}-algorithm", index_name),
                kind: "hnsw".to_string(),
                hnsw_parameters: Some(HnswParameters {
                    m: 4,
                    metric: "cosine".to_string(),
                    ef_construction: 400,
                    ef_search: 500,
                }),
                exhaustive_knn_parameters: None,
            }],
            vectorizers: vec![Vectorizer {
                name: format!("{}-azureOpenAi-text-vectorizer", index_name),
                kind: "azureOpenAI".to_string(),
                azure_open_ai_parameters: AzureOpenAiParameters {
                    resource_uri: search_config.vectorizer_resource_uri.clone(),
                    deployment_id: search_config.vectorizer_deployment_id.clone(),
                    api_key: search_config.vectorizer_api_key.clone(),
                    model_name: search_config.vectorizer_model_name.clone(),
                    auth_identity: None,
                },
                custom_web_api_parameters: None,
            }],
            compressions: vec![],
        },
    };

    let index_json = serde_json::to_string(&index)?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path("/indexes");
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let response = REQWEST_CLIENT
        .post(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .body(index_json)
        .send()
        .await?;

    // Check for a successful response
    if response.status().is_success() {
        println!("Index created successfully: {}", index_name);
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Failed to create index. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}

#[derive(Serialize, Deserialize)]
pub struct IndexAction<T> {
    #[serde(rename = "@search.action")]
    pub search_action: String,
    pub document: T,
}

#[derive(Serialize, Deserialize)]
pub struct IndexBatch<T> {
    pub value: Vec<IndexAction<T>>,
}

pub async fn add_documents_to_index<T>(
    index_name: &str,
    documents: Vec<T>,
    app_config: &ApplicationConfiguration,
) -> anyhow::Result<()>
where
    T: Serialize,
{
    let azure_config = app_config.azure_configuration.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure configuration is missing from the application configuration")
    })?;

    let search_config = azure_config.search_config.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Azure search configuration is missing from the Azure configuration")
    })?;

    let mut url = search_config.search_endpoint.clone();
    url.set_path(&format!("indexes('{}')/docs/index", index_name));
    url.set_query(Some(&format!("api-version={}", API_VERSION)));

    let index_actions: Vec<IndexAction<String>> = documents
        .into_iter()
        .map(|doc| IndexAction {
            search_action: "upload".to_string(),
            document: serde_json::to_string(&doc).unwrap(),
        })
        .collect();

    let batch = IndexBatch {
        value: index_actions,
    };

    let batch_json = serde_json::to_string(&batch)?;

    let response = REQWEST_CLIENT
        .post(url)
        .header("Content-Type", "application/json")
        .header("api-key", search_config.search_api_key.clone())
        .body(batch_json)
        .send()
        .await?;

    if response.status().is_success() {
        println!("Documents added successfully to index: {}", index_name);
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await?;
        Err(anyhow::anyhow!(
            "Failed to add documents to index. Status: {}. Error: {}",
            status,
            error_text
        ))
    }
}
