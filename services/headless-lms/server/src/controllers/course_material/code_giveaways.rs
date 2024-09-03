//! Controllers for requests starting with `/api/v0/course-material/code-giveaways`.

use crate::{domain::authorization::skip_authorize, prelude::*};
use models::code_giveaways::CodeGiveawayStatus;

/**
 GET /api/v0/course-material/code-giveaways/:id/status - Returns information about a code giveaway.
*/
#[instrument(skip(pool))]
async fn get_giveaway_status(
    user: AuthUser,
    code_giveaway_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CodeGiveawayStatus>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let res =
        models::code_giveaways::get_code_giveaway_status(&mut conn, *code_giveaway_id, user.id)
            .await?;
    token.authorized_ok(web::Json(res))
}

/**
 POST /api/v0/course-material/code-giveaways/:id/claim - Claim a code from a code giveaway. If user has not completed the course module that is a requirement for the code, returns an error.
*/
#[instrument(skip(pool))]
async fn claim_code_from_code_giveaway(
    user: AuthUser,
    code_giveaway_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<String>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let code_giveaway = models::code_giveaways::get_by_id(&mut conn, *code_giveaway_id).await?;
    if !code_giveaway.enabled {
        return Err(ControllerError::new(
            ControllerErrorType::Forbidden,
            "Code giveaway is not enabled.".to_string(),
            None,
        ));
    }
    if let Some(course_module_id) = code_giveaway.course_module_id {
        let course_module_completions =
            models::course_module_completions::get_all_by_user_id_and_course_module_id(
                &mut conn,
                user.id,
                course_module_id,
            )
            .await?;

        course_module_completions
            .iter()
            .find(|c| c.passed)
            .ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "You have not completed the required course module.".to_string(),
                    None,
                )
            })?;
    } else {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The required course module has not been configured to this code giveaway.".to_string(),
            None,
        ));
    }

    if code_giveaway.require_course_specific_research_consent {
        let answers =
            models::research_forms::get_all_research_form_answers_with_user_and_course_id(
                &mut conn,
                user.id,
                code_giveaway.course_id,
            )
            .await
            .optional()?;
        if let Some(answers) = answers {
            let consented = answers.iter().any(|a| a.research_consent);
            if !consented {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "You're not eligible for the code.".to_string(),
                    None,
                ));
            }
        } else {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "You have not completed the required research form.".to_string(),
                None,
            ));
        }
    }

    let already_given_code =
        models::code_giveaway_codes::get_code_given_to_user(&mut conn, *code_giveaway_id, user.id)
            .await?
            .map(|o| o.code);

    if let Some(code) = already_given_code {
        // This is for a pretty message, in the end a database constraint ensures that only one code can be given to a user.
        return token.authorized_ok(web::Json(code));
    }

    let give_code_result =
        models::code_giveaway_codes::give_some_code_to_user(&mut conn, *code_giveaway_id, user.id)
            .await;

    if let Err(_e) = &give_code_result {
        let codes_left =
            models::code_giveaway_codes::are_any_codes_left(&mut conn, *code_giveaway_id).await?;
        if !codes_left {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "The giveaway has ran out of codes.".to_string(),
                None,
            ));
        }
    }

    let code = give_code_result?.code;
    token.authorized_ok(web::Json(code))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}/status", web::get().to(get_giveaway_status))
        .route("/{id}/claim", web::post().to(claim_code_from_code_giveaway));
}
