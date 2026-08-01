//! The only Redis-aware part of the mock: key layout, generations, the per-request working set,
//! the write-back pipeline and the call log.
//!
//! The mock keeps its own connection rather than going through the cache wrapper, whose failures
//! are silent no-ops. A component tests assert against has to fail loudly.

use std::collections::{BTreeMap, HashMap};
use std::sync::RwLock;

use anyhow::{Context, anyhow};
use redis::{AsyncCommands, aio::ConnectionManager};
use serde::de::DeserializeOwned;
use tokio::sync::{Mutex, OnceCell};

use crate::prelude::*;

use super::faults::Fault;
use super::world::{
    CourseCode, MockAttainment, MockCourseUnit, MockEnrolment, MockPerson, MockProductAccessToken,
    MockSubmission, RecordedCall, StudentNumber, WorkingSet, WorldDefaults, WorldWrite,
    person_course_key,
};

const GENERATION_KEY: &str = "ms:generation";
const GENERATION_SEQ_KEY: &str = "ms:seq:generation";

const META: &str = "meta";
const PERSONS: &str = "persons";
const COURSE_UNITS: &str = "courseUnits";
const ENROLMENTS: &str = "enrolments";
const ATTAINMENTS: &str = "attainments";
const SUBMISSIONS: &str = "submissions";
const PRODUCT_TOKENS: &str = "productTokens";
const IDX_ENROLMENTS_BY_PERSON: &str = "idx:enrolmentsByPerson";
const IDX_ENROLMENTS_BY_REALISATION: &str = "idx:enrolmentsByRealisation";
const IDX_ATTAINMENTS_BY_PERSON_COURSE: &str = "idx:attainmentsByPersonCourse";
const IDX_SUBMISSIONS_BY_PERSON_COURSE: &str = "idx:submissionsByPersonCourse";
const IDX_OWNER_KEYS: &str = "idx:ownerKeys";
const FAULTS: &str = "faults";
const FAULTS_REMAINING: &str = "faults:remaining";
const FAULTS_ORDINAL: &str = "faults:ordinal";
const CALLS: &str = "calls";
const SEQ_CALL: &str = "seq:call";
const SEQ_PERSON: &str = "seq:person";
const SEQ_FAULT: &str = "seq:fault";

/// Closed by design: cleaning up a superseded generation is one `DEL` over these names, never a
/// keyspace scan.
const PREFIXED_KEYS: [&str; 19] = [
    META,
    PERSONS,
    COURSE_UNITS,
    ENROLMENTS,
    ATTAINMENTS,
    SUBMISSIONS,
    PRODUCT_TOKENS,
    IDX_ENROLMENTS_BY_PERSON,
    IDX_ENROLMENTS_BY_REALISATION,
    IDX_ATTAINMENTS_BY_PERSON_COURSE,
    IDX_SUBMISSIONS_BY_PERSON_COURSE,
    IDX_OWNER_KEYS,
    FAULTS,
    FAULTS_REMAINING,
    FAULTS_ORDINAL,
    CALLS,
    SEQ_CALL,
    SEQ_PERSON,
    SEQ_FAULT,
];

/// What one `HMGET` answers with: a slot per requested field, empty where the field is absent.
type Fields = Vec<Option<String>>;

/// A whole world, as installed under one generation. Indexes are not part of it: they are derived
/// from the entities so a caller cannot desynchronise them.
#[derive(Debug, Clone, Default)]
pub struct World {
    pub defaults: WorldDefaults,
    pub persons: BTreeMap<StudentNumber, MockPerson>,
    pub course_units: BTreeMap<CourseCode, MockCourseUnit>,
    pub enrolments: BTreeMap<String, MockEnrolment>,
    pub attainments: BTreeMap<String, MockAttainment>,
    pub product_tokens: BTreeMap<String, MockProductAccessToken>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerKeys {
    pub student_numbers: Vec<String>,
    pub course_codes: Vec<String>,
    pub product_ids: Vec<String>,
}

/// Everything a request needs before it may look at the body.
#[derive(Debug, Clone)]
pub struct Preamble {
    pub generation: String,
    pub defaults: WorldDefaults,
    /// False when the index holds no world under this generation, which is what an external flush
    /// looks like.
    pub defaults_present: bool,
    pub db_generation: Option<String>,
    /// In arm order, which is precedence.
    pub faults: Vec<Fault>,
    /// A hint that keeps a long-spent fault from costing a draw on every request. Never the
    /// decision: the draw at the match is.
    pub remaining: HashMap<String, i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldCounts {
    pub persons: usize,
    pub course_units: usize,
    pub enrolments: usize,
    pub attainments: usize,
    pub submissions: usize,
    pub product_tokens: usize,
    pub faults_armed: usize,
    pub faults_spent: usize,
    pub call_log_len: usize,
}

pub struct MockSuotarStore {
    client: redis::Client,
    connection: OnceCell<ConnectionManager>,
    /// One server process owns this index, so the live token can be cached and re-read only when a
    /// prefixed read comes back empty.
    generation: RwLock<Option<String>>,
    install_lock: Mutex<()>,
}

impl std::fmt::Debug for MockSuotarStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MockSuotarStore").finish()
    }
}

impl MockSuotarStore {
    /// Does no I/O: it parses the url and swaps in the mock's own database index, which is kept off
    /// the cache's so a flush touches nothing of the cache's. Connecting happens on first use, so an
    /// unreachable Redis is a per-request error rather than a cached success.
    pub fn new(redis_url: &str, db_index: i64) -> anyhow::Result<Self> {
        Ok(Self {
            client: redis::Client::open(database_url(redis_url, db_index)?)
                .context("failed to build the mock Suotar Redis client")?,
            connection: OnceCell::new(),
            generation: RwLock::new(None),
            install_lock: Mutex::new(()),
        })
    }

    async fn conn(&self) -> anyhow::Result<ConnectionManager> {
        let manager = self
            .connection
            .get_or_try_init(|| async { ConnectionManager::new(self.client.clone()).await })
            .await
            .context("the mock Suotar could not reach Redis")?;
        Ok(manager.clone())
    }

    fn cached_generation(&self) -> Option<String> {
        self.generation.read().ok().and_then(|g| g.clone())
    }

    fn cache_generation(&self, generation: Option<String>) {
        if let Ok(mut cached) = self.generation.write() {
            *cached = generation;
        }
    }

    pub async fn live_generation(&self) -> anyhow::Result<Option<String>> {
        if let Some(generation) = self.cached_generation() {
            return Ok(Some(generation));
        }
        let mut conn = self.conn().await?;
        let generation: Option<String> = conn.get(GENERATION_KEY).await?;
        self.cache_generation(generation.clone());
        Ok(generation)
    }

    /// Installs a world under a fresh generation and flips the pointer last, so no request ever
    /// sees a half-installed world and a push needs nothing cleared before it.
    pub async fn install_world(
        &self,
        world: &World,
        db_generation: Option<&str>,
    ) -> anyhow::Result<String> {
        let previous = self.live_generation().await?;
        let mut conn = self.conn().await?;
        let sequence: i64 = conn.incr(GENERATION_SEQ_KEY, 1).await?;
        let generation = format!("g{sequence}");

        let mut pipe = redis::pipe();
        pipe.atomic();
        pipe.hset(
            key(&generation, META),
            "defaults",
            serde_json::to_string(&world.defaults)?,
        )
        .ignore();
        pipe.hset(
            key(&generation, META),
            "installedAt",
            Utc::now().to_rfc3339(),
        )
        .ignore();
        if let Some(db_generation) = db_generation {
            pipe.hset(key(&generation, META), "dbGeneration", db_generation)
                .ignore();
        }
        write_entity_hash(&mut pipe, &generation, PERSONS, &world.persons)?;
        write_entity_hash(&mut pipe, &generation, COURSE_UNITS, &world.course_units)?;
        write_entity_hash(&mut pipe, &generation, ENROLMENTS, &world.enrolments)?;
        write_entity_hash(&mut pipe, &generation, ATTAINMENTS, &world.attainments)?;
        write_entity_hash(
            &mut pipe,
            &generation,
            PRODUCT_TOKENS,
            &world.product_tokens,
        )?;
        write_derived_indexes(&mut pipe, &generation, world)?;
        pipe.set(GENERATION_KEY, &generation).ignore();
        pipe.query_async::<()>(&mut conn).await?;

        self.cache_generation(Some(generation.clone()));

        if let Some(previous) = previous.filter(|previous| previous != &generation) {
            let mut cleanup = redis::pipe();
            for name in PREFIXED_KEYS {
                cleanup.del(key(&previous, name)).ignore();
            }
            cleanup.query_async::<()>(&mut conn).await?;
        }
        Ok(generation)
    }

    /// Installs `world` unless a request that got here first already did. Serialised so a burst of
    /// first requests against an empty index does not each mint a generation.
    pub async fn install_if_absent(
        &self,
        world: &World,
        db_generation: Option<&str>,
    ) -> anyhow::Result<String> {
        let _guard = self.install_lock.lock().await;
        self.cache_generation(None);
        if let Some(generation) = self.live_generation().await?
            && self.has_world(&generation).await?
        {
            return Ok(generation);
        }
        self.install_world(world, db_generation).await
    }

    async fn has_world(&self, generation: &str) -> anyhow::Result<bool> {
        let mut conn = self.conn().await?;
        let present: bool = conn.hexists(key(generation, META), "defaults").await?;
        Ok(present)
    }

    /// `FLUSHDB` and nothing else. Safe because the index is ours; the next contract request builds
    /// the world lazily.
    pub async fn flush(&self) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        redis::cmd("FLUSHDB").query_async::<()>(&mut conn).await?;
        self.cache_generation(None);
        Ok(())
    }

    pub async fn preamble(&self, generation: &str) -> anyhow::Result<Preamble> {
        let mut conn = self.conn().await?;
        let (meta, faults, remaining): (
            HashMap<String, String>,
            HashMap<String, String>,
            HashMap<String, i64>,
        ) = redis::pipe()
            .hgetall(key(generation, META))
            .hgetall(key(generation, FAULTS))
            .hgetall(key(generation, FAULTS_REMAINING))
            .query_async(&mut conn)
            .await?;

        let defaults = match meta.get("defaults") {
            Some(raw) => {
                serde_json::from_str(raw).context("stored world defaults are unreadable")?
            }
            None => WorldDefaults::default(),
        };
        let mut faults: Vec<Fault> = faults
            .values()
            .map(|raw| serde_json::from_str::<Fault>(raw))
            .collect::<Result<_, _>>()
            .context("a stored fault is unreadable")?;
        faults.sort_by_key(|fault| fault.seq);

        Ok(Preamble {
            generation: generation.to_string(),
            defaults_present: meta.contains_key("defaults"),
            defaults,
            db_generation: meta.get("dbGeneration").cloned(),
            faults,
            remaining,
        })
    }

    pub async fn load_persons(
        &self,
        generation: &str,
        student_numbers: &[String],
    ) -> anyhow::Result<BTreeMap<String, MockPerson>> {
        let mut conn = self.conn().await?;
        hmget_json(&mut conn, &key(generation, PERSONS), student_numbers).await
    }

    pub async fn load_product_tokens(
        &self,
        generation: &str,
        product_ids: &[String],
    ) -> anyhow::Result<BTreeMap<String, MockProductAccessToken>> {
        let mut conn = self.conn().await?;
        hmget_json(&mut conn, &key(generation, PRODUCT_TOKENS), product_ids).await
    }

    /// One pipelined trip for the person-and-course keyed hashes, then one for the entities those
    /// keys point at. Round trips stay independent of batch size.
    pub async fn load_for_person_course(
        &self,
        generation: &str,
        student_numbers: &[String],
        course_codes: &[String],
    ) -> anyhow::Result<WorkingSet> {
        let mut conn = self.conn().await?;
        let person_course_keys: Vec<String> = student_numbers
            .iter()
            .flat_map(|student_number| {
                course_codes
                    .iter()
                    .map(move |course_code| person_course_key(student_number, course_code))
            })
            .collect();

        let mut first = redis::pipe();
        push_hmget(&mut first, &key(generation, PERSONS), student_numbers);
        push_hmget(&mut first, &key(generation, COURSE_UNITS), course_codes);
        push_hmget(
            &mut first,
            &key(generation, IDX_ENROLMENTS_BY_PERSON),
            student_numbers,
        );
        push_hmget(
            &mut first,
            &key(generation, IDX_ATTAINMENTS_BY_PERSON_COURSE),
            &person_course_keys,
        );
        push_hmget(
            &mut first,
            &key(generation, IDX_SUBMISSIONS_BY_PERSON_COURSE),
            &person_course_keys,
        );
        let (persons, course_units, enrolments_by_person, attainment_ids, submission_ids): (
            Fields,
            Fields,
            Fields,
            Fields,
            Fields,
        ) = first.query_async(&mut conn).await?;

        let mut working = WorkingSet {
            persons: zip_json(student_numbers, persons)?,
            course_units: zip_json(course_codes, course_units)?,
            enrolments_by_person: zip_json(student_numbers, enrolments_by_person)?,
            attainments_by_person_course: zip_json(&person_course_keys, attainment_ids)?,
            submissions_by_person_course: zip_json(&person_course_keys, submission_ids)?,
            ..Default::default()
        };

        let enrolment_ids = flatten(working.enrolments_by_person.values());
        let attainment_ids = flatten(working.attainments_by_person_course.values());
        let submission_ids = flatten(working.submissions_by_person_course.values());

        let mut second = redis::pipe();
        push_hmget(&mut second, &key(generation, ENROLMENTS), &enrolment_ids);
        push_hmget(&mut second, &key(generation, ATTAINMENTS), &attainment_ids);
        push_hmget(&mut second, &key(generation, SUBMISSIONS), &submission_ids);
        let (enrolments, attainments, submissions): (Fields, Fields, Fields) =
            second.query_async(&mut conn).await?;

        working.enrolments = zip_json(&enrolment_ids, enrolments)?;
        working.attainments = zip_json(&attainment_ids, attainments)?;
        working.submissions = zip_json(&submission_ids, submissions)?;
        Ok(working)
    }

    /// Verify's body carries only submitted attainment ids, so the persons behind them come second.
    pub async fn load_for_verify(
        &self,
        generation: &str,
        submitted_attainment_ids: &[String],
    ) -> anyhow::Result<WorkingSet> {
        let mut conn = self.conn().await?;
        let submissions: BTreeMap<String, MockSubmission> = hmget_json(
            &mut conn,
            &key(generation, SUBMISSIONS),
            submitted_attainment_ids,
        )
        .await?;
        let student_numbers: Vec<String> = unique(
            submissions
                .values()
                .map(|submission| submission.student_number.clone()),
        );
        let persons = hmget_json(&mut conn, &key(generation, PERSONS), &student_numbers).await?;
        Ok(WorkingSet {
            persons,
            submissions,
            ..Default::default()
        })
    }

    pub async fn load_for_list_by_course(
        &self,
        generation: &str,
        course_codes: &[String],
    ) -> anyhow::Result<WorkingSet> {
        let mut conn = self.conn().await?;
        let course_units: BTreeMap<String, MockCourseUnit> =
            hmget_json(&mut conn, &key(generation, COURSE_UNITS), course_codes).await?;
        let realisation_ids: Vec<String> = unique(
            course_units
                .values()
                .flat_map(|unit| unit.realisations.iter().map(|r| r.id.clone())),
        );
        let enrolments_by_realisation: BTreeMap<String, Vec<String>> = hmget_json(
            &mut conn,
            &key(generation, IDX_ENROLMENTS_BY_REALISATION),
            &realisation_ids,
        )
        .await?;
        let enrolment_ids = flatten(enrolments_by_realisation.values());
        let enrolments: BTreeMap<String, MockEnrolment> =
            hmget_json(&mut conn, &key(generation, ENROLMENTS), &enrolment_ids).await?;
        let student_numbers: Vec<String> = unique(
            enrolments
                .values()
                .map(|enrolment| enrolment.student_number.clone()),
        );
        let persons = hmget_json(&mut conn, &key(generation, PERSONS), &student_numbers).await?;
        Ok(WorkingSet {
            persons,
            course_units,
            enrolments,
            enrolments_by_realisation,
            ..Default::default()
        })
    }

    /// The one write of a request: the entities it changed plus its call-log entry, in one atomic
    /// pipeline, committed before the response leaves the process.
    pub async fn commit(
        &self,
        generation: &str,
        working: &WorkingSet,
        call: &RecordedCall,
        call_log_capacity: usize,
    ) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        let mut pipe = redis::pipe();
        pipe.atomic();
        for write in &working.writes {
            match write {
                WorldWrite::UpsertSubmission(id) => {
                    let submission = working
                        .submissions
                        .get(id)
                        .ok_or_else(|| anyhow!("write names a submission the working set lost"))?;
                    pipe.hset(
                        key(generation, SUBMISSIONS),
                        id,
                        serde_json::to_string(submission)?,
                    )
                    .ignore();
                }
                WorldWrite::UpsertAttainment(id) => {
                    let attainment = working
                        .attainments
                        .get(id)
                        .ok_or_else(|| anyhow!("write names an attainment the working set lost"))?;
                    pipe.hset(
                        key(generation, ATTAINMENTS),
                        id,
                        serde_json::to_string(attainment)?,
                    )
                    .ignore();
                }
                WorldWrite::IndexSubmission {
                    student_number,
                    course_code,
                    ..
                } => {
                    let field = person_course_key(student_number, course_code);
                    let ids = working
                        .submissions_by_person_course
                        .get(&field)
                        .cloned()
                        .unwrap_or_default();
                    pipe.hset(
                        key(generation, IDX_SUBMISSIONS_BY_PERSON_COURSE),
                        field,
                        serde_json::to_string(&ids)?,
                    )
                    .ignore();
                }
                WorldWrite::IndexAttainment {
                    student_number,
                    course_code,
                    ..
                } => {
                    let field = person_course_key(student_number, course_code);
                    let ids = working
                        .attainments_by_person_course
                        .get(&field)
                        .cloned()
                        .unwrap_or_default();
                    pipe.hset(
                        key(generation, IDX_ATTAINMENTS_BY_PERSON_COURSE),
                        field,
                        serde_json::to_string(&ids)?,
                    )
                    .ignore();
                }
            }
        }
        pipe.lpush(key(generation, CALLS), serde_json::to_string(call)?)
            .ignore();
        pipe.ltrim(
            key(generation, CALLS),
            0,
            call_log_capacity.saturating_sub(1) as isize,
        )
        .ignore();
        pipe.query_async::<()>(&mut conn).await?;
        Ok(())
    }

    pub async fn next_call_seq(&self, generation: &str) -> anyhow::Result<u64> {
        let mut conn = self.conn().await?;
        let seq: i64 = conn.incr(key(generation, SEQ_CALL), 1).await?;
        Ok(seq.max(0) as u64)
    }

    pub async fn next_person_seq(&self, generation: &str) -> anyhow::Result<i64> {
        let mut conn = self.conn().await?;
        Ok(conn.incr(key(generation, SEQ_PERSON), 1).await?)
    }

    /// Re-arming an id takes a fresh one, so the fault moves to the back of arm order.
    pub async fn next_fault_seq(&self, generation: &str) -> anyhow::Result<u64> {
        let mut conn = self.conn().await?;
        let seq: i64 = conn.incr(key(generation, SEQ_FAULT), 1).await?;
        Ok(seq.max(0) as u64)
    }

    /// The caller acts on the returned value, never on a separate read.
    pub async fn draw(
        &self,
        generation: &str,
        hash: CounterHash,
        fault_id: &str,
        delta: i64,
    ) -> anyhow::Result<i64> {
        let mut conn = self.conn().await?;
        Ok(conn
            .hincr(key(generation, hash.name()), fault_id, delta)
            .await?)
    }

    pub async fn upsert_json<T: Serialize>(
        &self,
        generation: &str,
        hash: EntityHash,
        entries: &BTreeMap<String, T>,
    ) -> anyhow::Result<()> {
        if entries.is_empty() {
            return Ok(());
        }
        let mut conn = self.conn().await?;
        let mut pipe = redis::pipe();
        pipe.atomic();
        for (field, value) in entries {
            pipe.hset(
                key(generation, hash.name()),
                field,
                serde_json::to_string(value)?,
            )
            .ignore();
        }
        pipe.query_async::<()>(&mut conn).await?;
        Ok(())
    }

    pub async fn get_json<T: DeserializeOwned>(
        &self,
        generation: &str,
        hash: EntityHash,
        field: &str,
    ) -> anyhow::Result<Option<T>> {
        let mut conn = self.conn().await?;
        let raw: Option<String> = conn.hget(key(generation, hash.name()), field).await?;
        Ok(match raw {
            Some(raw) => Some(serde_json::from_str(&raw)?),
            None => None,
        })
    }

    pub async fn all_json<T: DeserializeOwned>(
        &self,
        generation: &str,
        hash: EntityHash,
    ) -> anyhow::Result<BTreeMap<String, T>> {
        let mut conn = self.conn().await?;
        let raw: HashMap<String, String> = conn.hgetall(key(generation, hash.name())).await?;
        raw.into_iter()
            .map(|(field, value)| Ok((field, serde_json::from_str(&value)?)))
            .collect()
    }

    pub async fn delete_fields(
        &self,
        generation: &str,
        hash: EntityHash,
        fields: &[String],
    ) -> anyhow::Result<()> {
        if fields.is_empty() {
            return Ok(());
        }
        let mut conn = self.conn().await?;
        conn.hdel::<_, _, ()>(key(generation, hash.name()), fields)
            .await?;
        Ok(())
    }

    pub async fn owner_keys(
        &self,
        generation: &str,
        field: &str,
    ) -> anyhow::Result<Option<OwnerKeys>> {
        self.get_json(generation, EntityHash::OwnerKeys, field)
            .await
    }

    pub async fn known_owner_refs(&self, generation: &str) -> anyhow::Result<Vec<String>> {
        let mut conn = self.conn().await?;
        let fields: Vec<String> = conn.hkeys(key(generation, IDX_OWNER_KEYS)).await?;
        Ok(fields)
    }

    pub async fn faults(&self, generation: &str) -> anyhow::Result<Vec<Fault>> {
        let mut faults: Vec<Fault> = self
            .all_json::<Fault>(generation, EntityHash::Faults)
            .await?
            .into_values()
            .collect();
        faults.sort_by_key(|fault| fault.seq);
        Ok(faults)
    }

    pub async fn remaining_budgets(
        &self,
        generation: &str,
    ) -> anyhow::Result<HashMap<String, i64>> {
        let mut conn = self.conn().await?;
        Ok(conn.hgetall(key(generation, FAULTS_REMAINING)).await?)
    }

    pub async fn arm_fault(&self, generation: &str, fault: &Fault) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        let mut pipe = redis::pipe();
        pipe.atomic();
        pipe.hset(
            key(generation, FAULTS),
            &fault.id,
            serde_json::to_string(fault)?,
        )
        .ignore();
        pipe.hset(
            key(generation, FAULTS_REMAINING),
            &fault.id,
            fault.lifetime.budget().unwrap_or(0) as i64,
        )
        .ignore();
        pipe.hset(key(generation, FAULTS_ORDINAL), &fault.id, 0)
            .ignore();
        pipe.query_async::<()>(&mut conn).await?;
        Ok(())
    }

    pub async fn disarm_faults(&self, generation: &str, ids: &[String]) -> anyhow::Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let mut conn = self.conn().await?;
        let mut pipe = redis::pipe();
        pipe.atomic();
        pipe.hdel(key(generation, FAULTS), ids).ignore();
        pipe.hdel(key(generation, FAULTS_REMAINING), ids).ignore();
        pipe.hdel(key(generation, FAULTS_ORDINAL), ids).ignore();
        pipe.query_async::<()>(&mut conn).await?;
        Ok(())
    }

    /// Every read of the call log is bounded: a list has no index, so a filter is always a scan.
    pub async fn recent_calls(
        &self,
        generation: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<RecordedCall>> {
        if limit == 0 {
            return Ok(Vec::new());
        }
        let mut conn = self.conn().await?;
        let raw: Vec<String> = conn
            .lrange(key(generation, CALLS), 0, limit as isize - 1)
            .await?;
        raw.iter()
            .map(|entry| {
                serde_json::from_str(entry).context("a stored call-log entry is unreadable")
            })
            .collect()
    }

    pub async fn counts(&self, generation: &str) -> anyhow::Result<WorldCounts> {
        let mut conn = self.conn().await?;
        let (
            persons,
            course_units,
            enrolments,
            attainments,
            submissions,
            product_tokens,
            call_log_len,
        ): (usize, usize, usize, usize, usize, usize, usize) = redis::pipe()
            .hlen(key(generation, PERSONS))
            .hlen(key(generation, COURSE_UNITS))
            .hlen(key(generation, ENROLMENTS))
            .hlen(key(generation, ATTAINMENTS))
            .hlen(key(generation, SUBMISSIONS))
            .hlen(key(generation, PRODUCT_TOKENS))
            .llen(key(generation, CALLS))
            .query_async(&mut conn)
            .await?;
        let faults = self.faults(generation).await?;
        let remaining = self.remaining_budgets(generation).await?;
        let spent = faults
            .iter()
            .filter(|fault| {
                fault.lifetime.budget().is_some()
                    && remaining.get(&fault.id).copied().unwrap_or(0) <= 0
            })
            .count();
        Ok(WorldCounts {
            persons,
            course_units,
            enrolments,
            attainments,
            submissions,
            product_tokens,
            faults_armed: faults.len() - spent,
            faults_spent: spent,
            call_log_len,
        })
    }

    pub async fn set_defaults(
        &self,
        generation: &str,
        defaults: &WorldDefaults,
    ) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        conn.hset::<_, _, _, ()>(
            key(generation, META),
            "defaults",
            serde_json::to_string(defaults)?,
        )
        .await?;
        Ok(())
    }

    pub async fn clear_hash(&self, generation: &str, hash: EntityHash) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        conn.del::<_, ()>(key(generation, hash.name())).await?;
        Ok(())
    }

    pub async fn clear_faults(&self, generation: &str) -> anyhow::Result<()> {
        let mut conn = self.conn().await?;
        let mut pipe = redis::pipe();
        pipe.atomic();
        for name in [FAULTS, FAULTS_REMAINING, FAULTS_ORDINAL] {
            pipe.del(key(generation, name)).ignore();
        }
        pipe.query_async::<()>(&mut conn).await?;
        Ok(())
    }

    /// Rebuilds every derived index from the entities currently stored, so an upsert cannot leave
    /// an index behind.
    pub async fn reindex(&self, generation: &str) -> anyhow::Result<()> {
        let world = World {
            defaults: WorldDefaults::default(),
            persons: self.all_json(generation, EntityHash::Persons).await?,
            course_units: self.all_json(generation, EntityHash::CourseUnits).await?,
            enrolments: self.all_json(generation, EntityHash::Enrolments).await?,
            attainments: self.all_json(generation, EntityHash::Attainments).await?,
            product_tokens: self.all_json(generation, EntityHash::ProductTokens).await?,
        };
        let submissions: BTreeMap<String, MockSubmission> =
            self.all_json(generation, EntityHash::Submissions).await?;

        let mut conn = self.conn().await?;
        let mut pipe = redis::pipe();
        pipe.atomic();
        for name in [
            IDX_ENROLMENTS_BY_PERSON,
            IDX_ENROLMENTS_BY_REALISATION,
            IDX_ATTAINMENTS_BY_PERSON_COURSE,
            IDX_SUBMISSIONS_BY_PERSON_COURSE,
            IDX_OWNER_KEYS,
        ] {
            pipe.del(key(generation, name)).ignore();
        }
        write_derived_indexes(&mut pipe, generation, &world)?;
        let mut by_person_course: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for submission in submissions.values() {
            by_person_course
                .entry(person_course_key(
                    &submission.student_number,
                    &submission.course_code,
                ))
                .or_default()
                .push(submission.submitted_attainment_id.clone());
        }
        for (field, ids) in by_person_course {
            pipe.hset(
                key(generation, IDX_SUBMISSIONS_BY_PERSON_COURSE),
                field,
                serde_json::to_string(&ids)?,
            )
            .ignore();
        }
        pipe.query_async::<()>(&mut conn).await?;
        Ok(())
    }
}

/// Hashes the command surface reads and writes by name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityHash {
    Persons,
    CourseUnits,
    Enrolments,
    Attainments,
    Submissions,
    ProductTokens,
    Faults,
    OwnerKeys,
    Calls,
}

impl EntityHash {
    fn name(self) -> &'static str {
        match self {
            Self::Persons => PERSONS,
            Self::CourseUnits => COURSE_UNITS,
            Self::Enrolments => ENROLMENTS,
            Self::Attainments => ATTAINMENTS,
            Self::Submissions => SUBMISSIONS,
            Self::ProductTokens => PRODUCT_TOKENS,
            Self::Faults => FAULTS,
            Self::OwnerKeys => IDX_OWNER_KEYS,
            Self::Calls => CALLS,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CounterHash {
    Remaining,
    Ordinal,
}

impl CounterHash {
    fn name(self) -> &'static str {
        match self {
            Self::Remaining => FAULTS_REMAINING,
            Self::Ordinal => FAULTS_ORDINAL,
        }
    }
}

fn database_url(redis_url: &str, db_index: i64) -> anyhow::Result<String> {
    let mut url = Url::parse(redis_url).context("REDIS_URL is not a url")?;
    url.set_path(&db_index.to_string());
    Ok(url.to_string())
}

fn key(generation: &str, name: &str) -> String {
    format!("ms:{generation}:{name}")
}

fn write_entity_hash<T: Serialize>(
    pipe: &mut redis::Pipeline,
    generation: &str,
    name: &str,
    entries: &BTreeMap<String, T>,
) -> anyhow::Result<()> {
    for (field, value) in entries {
        pipe.hset(key(generation, name), field, serde_json::to_string(value)?)
            .ignore();
    }
    Ok(())
}

fn write_derived_indexes(
    pipe: &mut redis::Pipeline,
    generation: &str,
    world: &World,
) -> anyhow::Result<()> {
    let mut by_person: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut by_realisation: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for enrolment in world.enrolments.values() {
        by_person
            .entry(enrolment.student_number.clone())
            .or_default()
            .push(enrolment.id.clone());
        by_realisation
            .entry(enrolment.realisation_id.clone())
            .or_default()
            .push(enrolment.id.clone());
    }
    let mut attainments_by_person_course: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for attainment in world.attainments.values() {
        attainments_by_person_course
            .entry(person_course_key(
                &attainment.student_number,
                &attainment.course_code,
            ))
            .or_default()
            .push(attainment.id.clone());
    }

    let mut owner_keys: BTreeMap<String, OwnerKeys> = BTreeMap::new();
    for person in world.persons.values() {
        if let Some(email) = &person.owner_user_email {
            owner_keys
                .entry(format!("user:{email}"))
                .or_default()
                .student_numbers
                .push(person.student_number.clone());
        }
    }
    for unit in world.course_units.values() {
        if let Some(slug) = &unit.owner_course_slug {
            let entry = owner_keys.entry(format!("course:{slug}")).or_default();
            entry.course_codes.push(unit.course_code.clone());
            for realisation in &unit.realisations {
                if let Some(product_id) = &realisation.open_university_product_id {
                    entry.product_ids.push(product_id.clone());
                }
            }
        }
    }

    for (name, index) in [
        (IDX_ENROLMENTS_BY_PERSON, by_person),
        (IDX_ENROLMENTS_BY_REALISATION, by_realisation),
        (
            IDX_ATTAINMENTS_BY_PERSON_COURSE,
            attainments_by_person_course,
        ),
    ] {
        for (field, ids) in index {
            pipe.hset(key(generation, name), field, serde_json::to_string(&ids)?)
                .ignore();
        }
    }
    for (field, keys) in owner_keys {
        pipe.hset(
            key(generation, IDX_OWNER_KEYS),
            field,
            serde_json::to_string(&keys)?,
        )
        .ignore();
    }
    Ok(())
}

/// Always `HMGET`, so the reply is an array whatever the field count — a single-field `HGET` answers
/// with a bare string, and no fields at all is a protocol error.
fn hmget_cmd(hash: &str, fields: &[String]) -> redis::Cmd {
    let mut cmd = redis::cmd("HMGET");
    cmd.arg(hash);
    if fields.is_empty() {
        cmd.arg("");
    }
    for field in fields {
        cmd.arg(field);
    }
    cmd
}

fn push_hmget(pipe: &mut redis::Pipeline, hash: &str, fields: &[String]) {
    pipe.add_command(hmget_cmd(hash, fields));
}

async fn hmget_json<T: DeserializeOwned>(
    conn: &mut ConnectionManager,
    hash: &str,
    fields: &[String],
) -> anyhow::Result<BTreeMap<String, T>> {
    if fields.is_empty() {
        return Ok(BTreeMap::new());
    }
    let values: Vec<Option<String>> = hmget_cmd(hash, fields).query_async(conn).await?;
    zip_json(fields, values)
}

fn zip_json<T: DeserializeOwned>(
    fields: &[String],
    values: Vec<Option<String>>,
) -> anyhow::Result<BTreeMap<String, T>> {
    let mut out = BTreeMap::new();
    for (field, value) in fields.iter().zip(values) {
        if let Some(value) = value {
            out.insert(
                field.clone(),
                serde_json::from_str(&value)
                    .with_context(|| format!("stored value for `{field}` is unreadable"))?,
            );
        }
    }
    Ok(out)
}

fn flatten<'a, I: Iterator<Item = &'a Vec<String>>>(lists: I) -> Vec<String> {
    unique(lists.flat_map(|list| list.iter().cloned()))
}

fn unique<I: Iterator<Item = String>>(values: I) -> Vec<String> {
    let mut out: Vec<String> = values.collect();
    out.sort();
    out.dedup();
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The whole "`FLUSHDB` here is safe" claim rests on the index actually being swapped, and the
    /// deployed url carries the cache's index 1 in its path.
    #[test]
    fn the_configured_url_is_moved_off_the_caches_index() {
        assert_eq!(
            database_url("redis://redis.default.svc.cluster.local/1", 2)
                .expect("the deployed url parses"),
            "redis://redis.default.svc.cluster.local/2"
        );
        assert!(MockSuotarStore::new("redis://redis.default.svc.cluster.local/1", 2).is_ok());
    }
}
