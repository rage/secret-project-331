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
        template_type: EmailTemplateType::ResetPasswordEmail,
        language: Some("en".to_string()),
        content: Some(english_body),
        subject: english_subject.map(|s| s.to_string()),
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
                "content": "Use this verification code to delete your account: {{CODE}}",
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
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "44444444-4444-4444-4444-444444444444",
            "attributes": {
                "content": "Hello, please use this code to verify your email address",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "55555555-5555-5555-5555-555555555555",
            "attributes": {
                "content": "Your verification code is: {{CODE}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "66666666-6666-6666-6666-666666666666",
            "attributes": {
                "content": "If you did not request this code, please ignore this message.",
                "drop_cap": false
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
    seed_student_notification_templates(&mut conn).await?;
    seed_student_number_linked_templates(&mut conn).await?;

    Ok(())
}

/// The two terminal-state mails a student may get about a credit registration, and the only two
/// that exist.
///
/// `{{ENROLMENT_LINK}}` is empty for a module with no open university product or no resolved access
/// token, so the sentence carrying it has to read correctly on its own; that degraded case is what
/// the configuration check reports as a problem.
async fn seed_student_notification_templates(conn: &mut sqlx::PgConnection) -> anyhow::Result<()> {
    info!("inserting credit registration student notification emails");

    let english_subject = Some("We could not register your credits yet");
    let english_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d3000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hello {{NAME}}, we could not register your {{CREDITS}} credits for {{COURSE_NAME}} because the University of Helsinki study registry has no active enrolment for you on this course.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d3000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Enrol on the course in Sisu and we will register the credits for you automatically. {{ENROLMENT_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d3000000-0000-0000-0000-000000000003",
            "attributes": {
                "content": "You can follow the registration here: {{STATUS_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationActionNeeded,
            language: Some("en".to_string()),
            content: Some(english_body),
            subject: english_subject.map(|s| s.to_string()),
        },
        english_subject,
    )
    .await?;

    let finnish_subject = Some("Emme voineet vielä kirjata opintopisteitäsi");
    let finnish_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d4000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hei {{NAME}}, emme voineet kirjata {{CREDITS}} opintopistettäsi kurssilta {{COURSE_NAME}}, koska Helsingin yliopiston opintorekisterissä ei ole sinulle voimassa olevaa ilmoittautumista tälle kurssille.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d4000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Ilmoittaudu kurssille Sisussa, niin kirjaamme opintopisteet puolestasi automaattisesti. {{ENROLMENT_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d4000000-0000-0000-0000-000000000003",
            "attributes": {
                "content": "Voit seurata kirjausta täältä: {{STATUS_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationActionNeeded,
            language: Some("fi".to_string()),
            content: Some(finnish_body),
            subject: finnish_subject.map(|s| s.to_string()),
        },
        finnish_subject,
    )
    .await?;

    // One template for `registered`, `duplicate` and `not_improved`: from the student's side the
    // credit exists either way, and a message that told them apart would only invite a support
    // question about a distinction they cannot act on.
    let english_subject = Some("Your credits are recorded in Sisu");
    let english_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d5000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hello {{NAME}}, your {{CREDITS}} credits for {{COURSE_NAME}} are now recorded in the University of Helsinki study registry.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d5000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "If the credits were already recorded there, this message simply confirms it. You can see the details here: {{STATUS_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationRegistered,
            language: Some("en".to_string()),
            content: Some(english_body),
            subject: english_subject.map(|s| s.to_string()),
        },
        english_subject,
    )
    .await?;

    let finnish_subject = Some("Opintopisteesi on kirjattu Sisuun");
    let finnish_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d6000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hei {{NAME}}, {{CREDITS}} opintopistettäsi kurssilta {{COURSE_NAME}} on nyt kirjattu Helsingin yliopiston opintorekisteriin.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d6000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Jos opintopisteet oli jo kirjattu sinne, tämä viesti vain vahvistaa sen. Näet tiedot täältä: {{STATUS_LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationRegistered,
            language: Some("fi".to_string()),
            content: Some(finnish_body),
            subject: finnish_subject.map(|s| s.to_string()),
        },
        finnish_subject,
    )
    .await?;

    Ok(())
}

/// Told to a student whose student number we linked from a matching verified email address, without
/// them clicking anything. A compensating control for that automatic link: it is how someone finds
/// out a number was attached to their account and can detach it.
async fn seed_student_number_linked_templates(conn: &mut sqlx::PgConnection) -> anyhow::Result<()> {
    info!("inserting credit registration student number linked emails");

    let english_subject = Some("Your student number was linked to your account");
    let english_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d7000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hello {{NAME}}, we linked student number {{STUDENT_NUMBER}} to your courses.mooc.fi account, because the University of Helsinki study registry holds this same confirmed email address for that student number.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d7000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Your credits will be registered under this student number. If it is not yours, remove it here: {{LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationStudentNumberLinked,
            language: Some("en".to_string()),
            content: Some(english_body),
            subject: english_subject.map(|s| s.to_string()),
        },
        english_subject,
    )
    .await?;

    let finnish_subject = Some("Opiskelijanumerosi liitettiin tiliisi");
    let finnish_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d8000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hei {{NAME}}, liitimme opiskelijanumeron {{STUDENT_NUMBER}} courses.mooc.fi-tiliisi, koska Helsingin yliopiston opintorekisterissä on samalle opiskelijanumerolle tämä sama vahvistettu sähköpostiosoite.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d8000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Opintopisteesi kirjataan tälle opiskelijanumerolle. Jos se ei ole sinun, poista se täältä: {{LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        }
    ]);

    insert_email_template(
        conn,
        None,
        EmailTemplateNew {
            template_type: EmailTemplateType::CreditRegistrationStudentNumberLinked,
            language: Some("fi".to_string()),
            content: Some(finnish_body),
            subject: finnish_subject.map(|s| s.to_string()),
        },
        finnish_subject,
    )
    .await?;

    Ok(())
}

/// The mail that carries a student-number linking link. Every placeholder comes from the delivery
/// row because the recipient may have no account here, and the "you received this because" line has
/// to stay because the message is unsolicited. A migration cannot insert a row using an enum value
/// it adds itself, so in dev and tests these templates come only from here.
async fn seed_account_linking_templates(conn: &mut sqlx::PgConnection) -> anyhow::Result<()> {
    info!("inserting credit registration account linking emails");

    let english_subject = Some("Link your student number to register your credits");
    let english_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hello {{NAME}}, you completed {{COURSE_NAME}} on courses.mooc.fi and we can register the credits for you.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Open this link while logged in to confirm that student number {{STUDENT_NUMBER}} is yours: {{LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d1000000-0000-0000-0000-000000000003",
            "attributes": {
                "content": "The link is valid for 14 days and can be used once. You received this message because you are enrolled in {{COURSE_NAME}} at the University of Helsinki and completed it on courses.mooc.fi. If this was not you, please ignore this message.",
                "drop_cap": false
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

    let finnish_subject = Some("Yhdistä opiskelijanumerosi, jotta voimme kirjata opintopisteesi");
    let finnish_body = json!([
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000001",
            "attributes": {
                "content": "Hei {{NAME}}, olet suorittanut kurssin {{COURSE_NAME}} courses.mooc.fi-palvelussa ja voimme kirjata opintopisteet puolestasi.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000002",
            "attributes": {
                "content": "Avaa tämä linkki kirjautuneena vahvistaaksesi, että opiskelijanumero {{STUDENT_NUMBER}} on sinun: {{LINK}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "d2000000-0000-0000-0000-000000000003",
            "attributes": {
                "content": "Linkki on voimassa 14 päivää ja sen voi käyttää kertaalleen. Sait tämän viestin, koska olet ilmoittautunut kurssille {{COURSE_NAME}} Helsingin yliopistossa ja suorittanut sen courses.mooc.fi-palvelussa. Jos tämä ei ollut sinä, voit jättää viestin huomiotta.",
                "drop_cap": false
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
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "77777777-7777-7777-7777-777777777777",
            "attributes": {
                "content": "Hello, please use this code to confirm the email address on your account.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "88888888-8888-8888-8888-888888888888",
            "attributes": {
                "content": "Your confirmation code is: {{CODE}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "99999999-9999-9999-9999-999999999999",
            "attributes": {
                "content": "If you did not request this, you can ignore this message. Nothing changes until the code is entered.",
                "drop_cap": false
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
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "aaaaaaaa-7777-7777-7777-777777777777",
            "attributes": {
                "content": "Hei, vahvista tilisi sähköpostiosoite tällä koodilla.",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "bbbbbbbb-8888-8888-8888-888888888888",
            "attributes": {
                "content": "Vahvistuskoodisi on: {{CODE}}",
                "drop_cap": false
            },
            "innerBlocks": []
        },
        {
            "type": "core/paragraph",
            "isValid": true,
            "clientId": "cccccccc-9999-9999-9999-999999999999",
            "attributes": {
                "content": "Jos et pyytänyt tätä, voit jättää viestin huomiotta. Mikään ei muutu ennen kuin koodi syötetään.",
                "drop_cap": false
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
