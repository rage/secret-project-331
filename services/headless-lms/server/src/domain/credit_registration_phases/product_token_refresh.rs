//! The `product-token-refresh` phase: keeping the open university product access tokens current.
//!
//! Load-bearing beyond its own counters. The token is what turns "you have no active enrolment" into
//! a link the student can actually follow, so a stale token is kept when a refresh fails: a link
//! built from a slightly old token beats no link at all.

use headless_lms_models::course_module_suotar_configurations::get_stalest_product_ids_for_enabled_modules;
use headless_lms_models::credit_registration_events::scrub_text;
use headless_lms_models::credit_registration_phase_state::PhaseRunOutcome;
use headless_lms_models::open_university_product_access_tokens::{
    NewOpenUniversityProductAccessToken, record_refresh_failure, upsert,
};
use headless_lms_models::secret::DbSecret;
use headless_lms_utils::prelude::BackendError;
use headless_lms_utils::services::suotar::{
    ProductAccessTokenRequestItem, SuotarCallContext, SuotarEndpoint, SuotarItemStatus,
};

use super::{CreditRegistrationPhase, PhaseContext, PhaseScope, every_item_failed_transiently};

pub async fn run(ctx: &PhaseContext<'_>, scope: &PhaseScope) -> anyhow::Result<PhaseRunOutcome> {
    let endpoint = SuotarEndpoint::ProductAccessTokens;
    let mut conn = ctx.pool.acquire().await?;
    let products = get_stalest_product_ids_for_enabled_modules(
        &mut conn,
        endpoint.max_batch_size() as i64,
        scope.course_id,
    )
    .await?;
    let attempted = i32::try_from(products.len()).unwrap_or(i32::MAX);
    if products.is_empty() {
        return Ok(PhaseRunOutcome::default());
    }

    let items: Vec<_> = products
        .iter()
        .map(|product_id| ProductAccessTokenRequestItem {
            request_item_id: request_item_id(product_id),
            open_university_product_id: product_id.clone(),
        })
        .collect();
    let response = ctx
        .suotar_client
        .resolve_product_access_tokens(
            SuotarCallContext::new(ctx.worker_name(CreditRegistrationPhase::ProductTokenRefresh)),
            items,
        )
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            let message = scrub_text(error.message());
            for product_id in &products {
                record_refresh_failure(&mut conn, product_id, &message).await?;
            }
            return Ok(PhaseRunOutcome {
                items_processed: attempted,
                items_failed: attempted,
                error: Some(message),
            });
        }
    };

    let mut items_failed = 0;
    for product_id in &products {
        let item = response.item(&request_item_id(product_id));
        let refreshed = match item {
            Some(item) if item.status == SuotarItemStatus::Ok => item.result.as_ref(),
            Some(item) => {
                let message = item
                    .error
                    .as_ref()
                    .map(|error| scrub_text(&error.message))
                    .unwrap_or_else(|| item.code.clone());
                record_refresh_failure(&mut conn, product_id, &message).await?;
                items_failed += 1;
                continue;
            }
            None => {
                record_refresh_failure(
                    &mut conn,
                    product_id,
                    "The study registry did not answer for this product.",
                )
                .await?;
                items_failed += 1;
                continue;
            }
        };
        let Some(refreshed) = refreshed else {
            record_refresh_failure(
                &mut conn,
                product_id,
                "The study registry reported success but sent no token.",
            )
            .await?;
            items_failed += 1;
            continue;
        };
        upsert(
            &mut conn,
            &NewOpenUniversityProductAccessToken {
                open_university_product_id: product_id.clone(),
                access_token: DbSecret::new(refreshed.access_token.clone()),
                state: refreshed.state.clone(),
                document_state: refreshed.document_state.clone(),
                suotar_token_id: Some(refreshed.id.clone()),
            },
        )
        .await?;
    }

    Ok(PhaseRunOutcome {
        items_processed: attempted,
        items_failed,
        error: every_item_failed_transiently(&response)
            .then(|| "Every product of the batch came back transiently unavailable.".to_string()),
    })
}

/// Products have no ledger row, so the id is derived from the product itself; they are distinct
/// within a batch by construction.
fn request_item_id(open_university_product_id: &str) -> String {
    format!("oup-{open_university_product_id}")
}
