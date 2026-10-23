//! The `guide` tool's handler. Block schemas come from the CMS export, cached briefly.

use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use serde_json::{Map, Value};
use tokio::sync::RwLock;

use super::args::GuideArgs;
use super::{RequestContext, ToolError, ToolHandler, ToolOutcome, ToolResult, parse_arguments};
use crate::guide::build_guide;
use crate::validator::{BlockSchemas, BlockValidator};

const SCHEMA_CACHE_TTL: Duration = Duration::from_secs(300);

pub struct GuideHandler {
    validator: Arc<dyn BlockValidator>,
    cache: RwLock<Option<(Instant, Arc<BlockSchemas>)>>,
}

impl GuideHandler {
    pub fn new(validator: Arc<dyn BlockValidator>) -> Self {
        Self {
            validator,
            cache: RwLock::new(None),
        }
    }

    async fn schemas(&self) -> Result<Arc<BlockSchemas>, ToolError> {
        if let Some((fetched_at, schemas)) = self.cache.read().await.as_ref()
            && fetched_at.elapsed() < SCHEMA_CACHE_TTL
        {
            return Ok(schemas.clone());
        }
        let schemas = Arc::new(self.validator.block_schemas().await?);
        *self.cache.write().await = Some((Instant::now(), schemas.clone()));
        Ok(schemas)
    }
}

#[async_trait]
impl<S: Send + Sync> ToolHandler<S> for GuideHandler {
    async fn call(
        &self,
        _: &S,
        _: &RequestContext,
        arguments: Map<String, Value>,
    ) -> Result<ToolOutcome, ToolError> {
        let args: GuideArgs = parse_arguments(arguments)?;
        let block_types = args.block_types.unwrap_or_default();
        let topics = args.topics.unwrap_or_default();
        let schemas = if block_types.is_empty() && !topics.is_empty() {
            None
        } else {
            Some(self.schemas().await?)
        };
        let guide = build_guide(schemas.as_deref(), &block_types, &topics)?;
        Ok(ToolResult::success(guide).into())
    }
}
