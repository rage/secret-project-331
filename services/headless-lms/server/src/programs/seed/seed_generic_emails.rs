use headless_lms_models::{
    email_templates::{EmailTemplateNew, insert_email_template},
    user_passwords::insert_password_reset_token,
};
use serde_json::json;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

use super::seed_users::SeedUsersResult;

pub async fn seed_generic_emails(
    db_pool: Pool<Postgres>,
    seed_users_result: SeedUsersResult,
) -> anyhow::Result<()> {
    info!("inserting password reset emails");

    let mut conn = db_pool.acquire().await?;

    let english_subject = Some("Reset password request");
    let english_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "95acea49-1c92-4d54-9854-707e1bfee010",
            "attributes": {
                "content": "Hello, it seems you requested a password reset.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "ceac591d-b291-40b2-8da7-6f437a6a8fce",
            "attributes": {
                "content": "You can reset your password here: {{RESET_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "6a4165a1-38e1-4a17-b364-5f265afc7d23",
            "attributes": {
                "content": "If you did not request a password reset, please ignore this message.",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    let english_template = EmailTemplateNew {
        name: "reset-password-email".to_string(),
        language: Some("en".to_string()),
        content: Some(english_body),
    };

    insert_email_template(&mut conn, None, english_template, english_subject).await?;

    let finnish_subject = Some("Salasanan palautuspyyntö");
    let finnish_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "a9de49ff-919f-44b4-a085-9210ce0da94b",
            "attributes": {
                "content": "Hei, olet pyytänyt salasanan palautusta.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "c145bae4-9ff5-4194-8913-50f8900c20c8",
            "attributes": {
                "content": "Voit palauttaa salasanasi tästä: {{RESET_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "ebd0d430-0ae3-4b85-9e8e-96481660ded4",
            "attributes": {
                "content": "Jos et pyytänyt salasanan palautusta, voit jättää tämän viestin huomiotta.",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    let finnish_template = EmailTemplateNew {
        name: "reset-password-email".to_string(),
        language: Some("fi".to_string()),
        content: Some(finnish_body),
    };

    insert_email_template(&mut conn, None, finnish_template, finnish_subject).await?;

    info!("inserting password reset token for user");
    let SeedUsersResult { sign_up_user, .. } = seed_users_result;
    insert_password_reset_token(
        &mut conn,
        sign_up_user,
        Uuid::parse_str("5a831370-6b7e-4ece-b962-6bc31c28fe53")?,
    )
    .await?;

    info!("inserting delete account email");

    let delete_subject = Some("Account deletion code");
    let delete_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "11111111-1111-1111-1111-111111111111",
            "attributes": {
                "content": "Hello, it seems you requested a code for deleting your account",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "22222222-2222-2222-2222-222222222222",
            "attributes": {
                "content": "You can reset your with this {{CODE}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "33333333-3333-3333-3333-333333333333",
            "attributes": {
                "content": "If you did not request a code, please ignore this message.",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    let delete_template = EmailTemplateNew {
        name: "delete-user-email".to_string(),
        language: Some("en".to_string()),
        content: Some(delete_body),
    };

    insert_email_template(&mut conn, None, delete_template, delete_subject).await?;

    Ok(())
}
