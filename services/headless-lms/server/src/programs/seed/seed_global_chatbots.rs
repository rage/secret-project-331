use headless_lms_models::{
    PKeyPolicy,
    chatbot_configurations::{self, NewChatbotConf},
    chatbot_configurations_models,
};

use sqlx::{Pool, Postgres};

pub async fn seed_global_chatbots(db_pool: Pool<Postgres>) -> anyhow::Result<()> {
    info!("inserting global chatbots");
    let mut conn = db_pool.acquire().await?;

    let llm = chatbot_configurations_models::get_default(&mut conn).await?;

    chatbot_configurations::insert(
        &mut conn,
        PKeyPolicy::Generate,
        NewChatbotConf {
            course_id: None,
            chatbot_name: "Global chatbot".to_string(),
            prompt: "You are a global chatbot.".to_string(),
            initial_message: "Hello, I'm a global chatbot.".to_string(),
            model_id: llm.id,
            ..Default::default()
        },
    )
    .await?;

    Ok(())
}
