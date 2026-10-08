use headless_lms_models::{
    email_templates::{EmailTemplateNew, EmailTemplateType, insert_email_template},
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
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "95acea49-1c92-4d54-9854-707e1bfee010",
            "attributes": {
                "content": "Hello, it seems you requested a password reset.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "ceac591d-b291-40b2-8da7-6f437a6a8fce",
            "attributes": {
                "content": "Click the button below to choose a new password.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/buttons",
            "isValid": true,
            "clientId": "e1000000-0000-0000-0000-000000000001",
            "attributes": {},
            "innerBlocks": [
                {
                    "name": "core/button",
                    "isValid": true,
                    "clientId": "e1000000-0000-0000-0000-000000000002",
                    "attributes": {
                        "text": "Reset password",
                        "url": "{{RESET_LINK}}"
                    },
                    "innerBlocks": []
                }
            ]
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "6a4165a1-38e1-4a17-b364-5f265afc7d23",
            "attributes": {
                "content": "If you did not request a password reset, please ignore this message.",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    let english_template = EmailTemplateNew {
        template_type: EmailTemplateType::ResetPasswordEmail,
        language: Some("en".to_string()),
        content: Some(english_body),
        subject: english_subject.map(|s| s.to_string()),
    };

    insert_email_template(&mut conn, None, english_template, english_subject).await?;

    let finnish_subject = Some("Salasanan palautuspyyntö");
    let finnish_body = json!([
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "a9de49ff-919f-44b4-a085-9210ce0da94b",
            "attributes": {
                "content": "Hei, olet pyytänyt salasanan palautusta.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "c145bae4-9ff5-4194-8913-50f8900c20c8",
            "attributes": {
                "content": "Valitse uusi salasana alla olevasta painikkeesta.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/buttons",
            "isValid": true,
            "clientId": "e2000000-0000-0000-0000-000000000001",
            "attributes": {},
            "innerBlocks": [
                {
                    "name": "core/button",
                    "isValid": true,
                    "clientId": "e2000000-0000-0000-0000-000000000002",
                    "attributes": {
                        "text": "Palauta salasana",
                        "url": "{{RESET_LINK}}"
                    },
                    "innerBlocks": []
                }
            ]
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "ebd0d430-0ae3-4b85-9e8e-96481660ded4",
            "attributes": {
                "content": "Jos et pyytänyt salasanan palautusta, voit jättää tämän viestin huomiotta.",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    let finnish_template = EmailTemplateNew {
        template_type: EmailTemplateType::ResetPasswordEmail,
        language: Some("fi".to_string()),
        content: Some(finnish_body),
        subject: finnish_subject.map(|s| s.to_string()),
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
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "11111111-1111-1111-1111-111111111111",
            "attributes": {
                "content": "Hello, it seems you requested a code for deleting your account",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "22222222-2222-2222-2222-222222222222",
            "attributes": {
                "content": "Use this verification code to delete your account:",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "moocfi/email-one-time-code",
            "isValid": true,
            "clientId": "e3000000-0000-0000-0000-000000000001",
            "attributes": {
                "code": "{{CODE}}"
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "33333333-3333-3333-3333-333333333333",
            "attributes": {
                "content": "If you did not request a code, please ignore this message.",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    let delete_template = EmailTemplateNew {
        template_type: EmailTemplateType::DeleteUserEmail,
        language: Some("en".to_string()),
        content: Some(delete_body),
        subject: delete_subject.map(|s| s.to_string()),
    };

    insert_email_template(&mut conn, None, delete_template, delete_subject).await?;

    info!("inserting confirm email code email");

    let confirm_subject = Some("Email verification code");
    let confirm_body = json!([
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "44444444-4444-4444-4444-444444444444",
            "attributes": {
                "content": "Hello, please use this code to verify your email address",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "55555555-5555-5555-5555-555555555555",
            "attributes": {
                "content": "Your verification code is:",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "moocfi/email-one-time-code",
            "isValid": true,
            "clientId": "e3000000-0000-0000-0000-000000000002",
            "attributes": {
                "code": "{{CODE}}"
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "66666666-6666-6666-6666-666666666666",
            "attributes": {
                "content": "If you did not request this code, please ignore this message.",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    let confirm_template = EmailTemplateNew {
        template_type: EmailTemplateType::ConfirmEmailCode,
        language: Some("en".to_string()),
        content: Some(confirm_body),
        subject: confirm_subject.map(|s| s.to_string()),
    };

    insert_email_template(&mut conn, None, confirm_template, confirm_subject).await?;

    seed_email_ownership_verification_templates(&mut conn).await?;
    seed_account_linking_templates(&mut conn).await?;
    seed_credit_registration_status_templates(&mut conn).await?;

    Ok(())
}

/// The mail that carries a student-number linking link. Every placeholder comes from the delivery
/// row because the recipient may have no account here, and the "you received this because" line has
/// to stay because the message is unsolicited. A migration cannot insert a row using an enum value
/// it adds itself, so in dev and tests these templates come only from here.
async fn seed_account_linking_templates(conn: &mut sqlx::PgConnection) -> anyhow::Result<()> {
    info!("inserting credit registration account linking emails");

    let english_subject =
        Some("Link your University of Helsinki student number to register your credits");
    let english_body = json!([
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hello, we can see your enrolment on {{COURSE_NAME}}. To register your credits in Sisu, we need to link your University of Helsinki student number {{STUDENT_NUMBER}} to your account on courses.mooc.fi.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Log in to courses.mooc.fi with the account you use for the course, then press the button below.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/buttons",
            "isValid": true,
            "clientId": "e4000000-0000-0000-0000-000000000001",
            "attributes": {},
            "innerBlocks": [
                {
                    "name": "core/button",
                    "isValid": true,
                    "clientId": "e4000000-0000-0000-0000-000000000002",
                    "attributes": {
                        "text": "Link student number",
                        "url": "{{LINK}}"
                    },
                    "innerBlocks": []
                }
            ]
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000003",
            "attributes": {
                "content": "The link works once, for 14 days. It is fine if this email address is different from the one you use on courses.mooc.fi.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000004",
            "attributes": {
                "content": "You got this email because you are enrolled on {{COURSE_NAME}} at the University of Helsinki. If that is not you, ignore this email.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000005",
            "attributes": {
                "content": "Best regards,<br>MOOC.fi",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationAccountLinking,
            language: Some("en".to_string()),
            content: Some(english_body),
            subject: english_subject.map(|s| s.to_string()),
        },
        english_subject,
    )
    .await?;

    let finnish_subject =
        Some("Liitä Helsingin yliopiston opiskelijanumerosi, jotta voimme kirjata opintopisteesi");
    let finnish_body = json!([
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hei, näemme ilmoittautumisesi kurssille {{COURSE_NAME}}. Jotta voimme kirjata opintopisteesi Sisuun, meidän pitää liittää Helsingin yliopiston opiskelijanumerosi {{STUDENT_NUMBER}} courses.mooc.fi-tiliisi.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Kirjaudu courses.mooc.fi-palveluun sillä tilillä, jolla teet kurssia, ja paina sitten alla olevaa painiketta.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/buttons",
            "isValid": true,
            "clientId": "e5000000-0000-0000-0000-000000000001",
            "attributes": {},
            "innerBlocks": [
                {
                    "name": "core/button",
                    "isValid": true,
                    "clientId": "e5000000-0000-0000-0000-000000000002",
                    "attributes": {
                        "text": "Liitä opiskelijanumero",
                        "url": "{{LINK}}"
                    },
                    "innerBlocks": []
                }
            ]
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000003",
            "attributes": {
                "content": "Linkki toimii kerran, 14 päivän ajan. Ei haittaa, jos tämä sähköpostiosoite on eri kuin courses.mooc.fi:ssä käyttämäsi.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000004",
            "attributes": {
                "content": "Sait tämän viestin, koska olet ilmoittautunut Helsingin yliopiston kurssille {{COURSE_NAME}}. Jos se et ole sinä, voit jättää viestin huomiotta.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000005",
            "attributes": {
                "content": "Terveisin,<br>MOOC.fi",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationAccountLinking,
            language: Some("fi".to_string()),
            content: Some(finnish_body),
            subject: finnish_subject.map(|s| s.to_string()),
        },
        finnish_subject,
    )
    .await?;

    Ok(())
}

/// The sender looks the account's pending code up at send time and substitutes `{{CODE}}`, as it does
/// for the login and account deletion codes.
///
/// A migration cannot insert a template row using an enum value it adds itself, so in dev and tests
/// the `verify_email_address` templates come only from here.
async fn seed_email_ownership_verification_templates(
    conn: &mut sqlx::PgConnection,
) -> anyhow::Result<()> {
    info!("inserting email address verification emails");

    let english_subject = Some("Confirm your email address");
    let english_body = json!([
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "77777777-7777-7777-7777-777777777777",
            "attributes": {
                "content": "Hello, please use this code to confirm the email address on your account.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "88888888-8888-8888-8888-888888888888",
            "attributes": {
                "content": "Your confirmation code is:",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "moocfi/email-one-time-code",
            "isValid": true,
            "clientId": "e3000000-0000-0000-0000-000000000003",
            "attributes": {
                "code": "{{CODE}}"
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "99999999-9999-9999-9999-999999999999",
            "attributes": {
                "content": "If you did not request this, you can ignore this message. Nothing changes until the code is entered.",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::VerifyEmailAddress,
            language: Some("en".to_string()),
            content: Some(english_body),
            subject: english_subject.map(|s| s.to_string()),
        },
        english_subject,
    )
    .await?;

    let finnish_subject = Some("Vahvista sähköpostiosoitteesi");
    let finnish_body = json!([
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "aaaaaaaa-7777-7777-7777-777777777777",
            "attributes": {
                "content": "Hei, vahvista tilisi sähköpostiosoite tällä koodilla.",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "bbbbbbbb-8888-8888-8888-888888888888",
            "attributes": {
                "content": "Vahvistuskoodisi on:",
                "dropCap": false
            },
            "innerBlocks": []
        },
        {
            "name": "moocfi/email-one-time-code",
            "isValid": true,
            "clientId": "e3000000-0000-0000-0000-000000000004",
            "attributes": {
                "code": "{{CODE}}"
            },
            "innerBlocks": []
        },
        {
            "name": "core/paragraph",
            "isValid": true,
            "clientId": "cccccccc-9999-9999-9999-999999999999",
            "attributes": {
                "content": "Jos et pyytänyt tätä, voit jättää viestin huomiotta. Mikään ei muutu ennen kuin koodi syötetään.",
                "dropCap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::VerifyEmailAddress,
            language: Some("fi".to_string()),
            content: Some(finnish_body),
            subject: finnish_subject.map(|s| s.to_string()),
        },
        finnish_subject,
    )
    .await?;

    Ok(())
}

/// The credit registration student mails. Their only link is the status page, since students enrol
/// in different ways.
async fn seed_credit_registration_status_templates(
    conn: &mut sqlx::PgConnection,
) -> anyhow::Result<()> {
    info!("inserting credit registration status emails");

    const BUTTON_AFTER_PARAGRAPH: usize = 2;

    let templates: [(EmailTemplateType, &str, &str, &str, &[&str]); 4] = [
        (
            EmailTemplateType::CreditRegistrationActionNeeded,
            "en",
            "One more step to get your credits registered",
            "See how to enrol",
            &[
                "Hello, congratulations on completing {{COURSE_NAME}}! You have earned {{CREDITS}} credits.",
                "To get them registered in Sisu, enrol on the course. The button below shows how.",
                "After you enrol, we register your credits automatically. If your University of Helsinki student number is not linked yet, we first send an account linking email to your primary email address in Sisu. If you have already enrolled, you do not need to enrol again.",
                "Best regards,<br>MOOC.fi",
            ],
        ),
        (
            EmailTemplateType::CreditRegistrationActionNeeded,
            "fi",
            "Vielä yksi vaihe opintopisteiden kirjaamiseen",
            "Katso ilmoittautumisohjeet",
            &[
                "Hei, onnittelut kurssin {{COURSE_NAME}} suorittamisesta! Olet ansainnut {{CREDITS}} op.",
                "Jotta opintopisteet voidaan kirjata Sisuun, ilmoittaudu kurssille. Alla olevasta painikkeesta näet, miten.",
                "Ilmoittautumisen jälkeen kirjaamme opintopisteesi automaattisesti. Jos Helsingin yliopiston opiskelijanumeroasi ei ole vielä liitetty, lähetämme ensin tilin yhdistämisviestin Sisussa olevaan ensisijaiseen sähköpostiosoitteeseesi. Jos olet jo ilmoittautunut, sinun ei tarvitse ilmoittautua uudelleen.",
                "Terveisin,<br>MOOC.fi",
            ],
        ),
        (
            EmailTemplateType::CreditRegistrationRegistered,
            "en",
            "Your credits have been registered",
            "See the details",
            &[
                "Hello, your {{CREDITS}} credits for {{COURSE_NAME}} are now registered in Sisu.",
                "You do not need to do anything else.",
                "Best regards,<br>MOOC.fi",
            ],
        ),
        (
            EmailTemplateType::CreditRegistrationRegistered,
            "fi",
            "Opintopisteesi on kirjattu",
            "Katso tiedot",
            &[
                "Hei, kurssin {{COURSE_NAME}} opintopisteesi ({{CREDITS}} op) on nyt kirjattu Sisuun.",
                "Sinun ei tarvitse tehdä muuta.",
                "Terveisin,<br>MOOC.fi",
            ],
        ),
    ];

    for (template_index, (template_type, language, subject, button_label, paragraphs)) in
        templates.into_iter().enumerate()
    {
        let mut blocks: Vec<_> = paragraphs
            .iter()
            .enumerate()
            .map(|(paragraph_index, content)| {
                json!({
                    "name": "core/paragraph",
                    "isValid": true,
                    "clientId": format!(
                        "d{}000000-0000-0000-0000-{:012}",
                        template_index + 3,
                        paragraph_index + 1
                    ),
                    "attributes": {
                        "content": content,
                        "dropCap": false
                    },
                    "innerBlocks": []
                })
            })
            .collect();
        blocks.insert(
            BUTTON_AFTER_PARAGRAPH,
            json!({
                "name": "core/buttons",
                "isValid": true,
                "clientId": format!("d{}000000-0000-0000-0000-{:012}", template_index + 3, 100),
                "attributes": {},
                "innerBlocks": [{
                    "name": "core/button",
                    "isValid": true,
                    "clientId": format!("d{}000000-0000-0000-0000-{:012}", template_index + 3, 101),
                    "attributes": { "text": button_label, "url": "{{STATUS_LINK}}" },
                    "innerBlocks": []
                }]
            }),
        );

        insert_email_template(
            conn,
            None,
            EmailTemplateNew {
                template_type,
                language: Some(language.to_string()),
                content: Some(json!(blocks)),
                subject: Some(subject.to_string()),
            },
            Some(subject),
        )
        .await?;
    }

    Ok(())
}
