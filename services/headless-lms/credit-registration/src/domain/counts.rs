//! What a phase iteration did, as the phase-state row and the batch summaries report it.

use uuid::Uuid;

use super::claim::ClaimedRegistration;
use super::decision::Applied;
use crate::registry::BatchEntry;

/// What a phase body did. Composite phases add up their flows' counts with `+=`.
///
/// `failed` never exceeds `processed`: a failure is counted only with the row, or module, it
/// failed.
#[derive(Debug, Default)]
pub(crate) struct Counts {
    processed: i32,
    failed: i32,
    /// Rows another writer moved on before their answer could be written, which are not processed.
    moved_on: i32,
    finding: Option<String>,
}

impl Counts {
    /// A clean iteration that moved `count` rows; saturating, so an over-large sweep never reaches
    /// the dashboard as negative throughput.
    pub(crate) fn processed(count: i64) -> Self {
        Self {
            processed: count.try_into().unwrap_or(i32::MAX),
            ..Self::default()
        }
    }

    /// `failed` of the `processed` rows, or modules, ended up carrying an error.
    pub(crate) fn processed_with_failures(processed: i32, failed: i32) -> Self {
        debug_assert!(failed <= processed, "{failed} failed of {processed}");
        Self {
            processed,
            failed,
            ..Self::default()
        }
    }

    pub(crate) fn all_failed(count: i32) -> Self {
        Self::processed_with_failures(count, count)
    }

    /// Something the phase found wrong that failed no row, such as a missing mail template: the
    /// iteration's error when no request failed.
    pub(crate) fn with_finding(self, finding: Option<String>) -> Self {
        Self { finding, ..self }
    }

    /// One row a decision was written for without asking the registry.
    pub(crate) fn record_decided(&mut self, is_failure: bool) {
        self.processed += 1;
        self.failed += i32::from(is_failure);
    }

    /// One answered or refused row's write. A row that had already moved on is only logged at debug:
    /// the batch summary reports it, and a study registry outage can make it routine.
    pub(crate) fn record_applied(&mut self, registration_id: Uuid, applied: Applied) {
        match applied {
            Applied::Written { is_failure } => self.record_decided(is_failure),
            Applied::MovedOn { found } => {
                self.moved_on += 1;
                debug!(
                    credit_registration_id = %registration_id,
                    found_state = ?found,
                    "Credit registration moved on while the study registry answered; leaving it"
                );
            }
        }
    }

    /// The rows, or modules, the iteration wrote a decision for.
    pub(crate) fn processed_count(&self) -> i32 {
        self.processed
    }

    /// How many of the processed ones ended up carrying an error code.
    pub(crate) fn failed_count(&self) -> i32 {
        self.failed
    }

    pub(crate) fn moved_on_count(&self) -> i32 {
        self.moved_on
    }

    pub(crate) fn into_finding(self) -> Option<String> {
        self.finding
    }
}

impl std::ops::AddAssign for Counts {
    fn add_assign(&mut self, other: Self) {
        self.processed += other.processed;
        self.failed += other.failed;
        self.moved_on += other.moved_on;
        self.finding = self.finding.take().or(other.finding);
    }
}

/// What a batch flow's claim settled before anything is sent: the rows to send, each with what it
/// asks, and the rows it already wrote a decision for.
pub(crate) struct Prepared<Row, Request> {
    sendable: Vec<BatchEntry<Row, Request>>,
    decided: Counts,
}

impl<Row: AsRef<ClaimedRegistration>, Request> Prepared<Row, Request> {
    pub(crate) fn new() -> Self {
        Self {
            sendable: Vec::new(),
            decided: Counts::default(),
        }
    }

    /// Puts `row` in the batch, asking `request`.
    pub(crate) fn send(&mut self, row: Row, request: Request) {
        self.sendable.push(BatchEntry {
            registration_id: row.as_ref().registration().id,
            row,
            request,
        });
    }

    /// A row the claim wrote a decision for, which is owed no answer.
    pub(crate) fn record_decided(&mut self, is_failure: bool) {
        self.decided.record_decided(is_failure);
    }

    pub(crate) fn sendable(&self) -> &[BatchEntry<Row, Request>] {
        &self.sendable
    }

    /// The batch, and the counts the claim's own decisions start the iteration with.
    pub(crate) fn into_parts(self) -> (Vec<BatchEntry<Row, Request>>, Counts) {
        (self.sendable, self.decided)
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::*;
    use crate::test_fixtures::registration;

    fn written(is_failure: bool) -> Applied {
        Applied::Written { is_failure }
    }

    const MOVED_ON: Applied = Applied::MovedOn {
        found: State::Registered,
    };

    #[test]
    fn a_moved_on_row_is_counted_apart_from_the_processed_ones() {
        let mut counts = Counts::default();
        for applied in [written(false), written(true), MOVED_ON, MOVED_ON] {
            counts.record_applied(Uuid::new_v4(), applied);
        }
        assert_eq!(counts.processed_count(), 2);
        assert_eq!(counts.failed_count(), 1);
        assert_eq!(counts.moved_on_count(), 2);
    }

    #[test]
    fn failures_never_outnumber_processed_rows() {
        let steps = [Some(true), None, Some(false), Some(true), None, Some(true)];
        let mut counts = Counts::default();
        for step in steps {
            match step {
                Some(is_failure) => counts.record_decided(is_failure),
                None => counts.record_applied(Uuid::new_v4(), MOVED_ON),
            }
            assert!(counts.failed_count() <= counts.processed_count());
        }
        assert_eq!(counts.processed_count(), 4);
        assert_eq!(counts.failed_count(), 3);
    }

    #[test]
    fn adding_counts_sums_them_and_keeps_the_first_finding() {
        let mut counts = Counts::processed_with_failures(3, 1).with_finding(None);
        let mut moved = Counts::all_failed(2).with_finding(Some("second".to_string()));
        moved.record_applied(Uuid::new_v4(), MOVED_ON);
        counts += moved;
        counts += Counts::processed(4).with_finding(Some("third".to_string()));
        assert_eq!(counts.processed_count(), 9);
        assert_eq!(counts.failed_count(), 3);
        assert_eq!(counts.moved_on_count(), 1);
        assert_eq!(counts.into_finding().as_deref(), Some("second"));
    }

    #[test]
    fn an_oversized_sweep_saturates_instead_of_going_negative() {
        assert_eq!(Counts::processed(i64::MAX).processed_count(), i32::MAX);
    }

    #[test]
    fn a_claim_keeps_its_own_decisions_apart_from_the_batch_it_sends() {
        let first = ClaimedRegistration::left_in_place(registration(State::AwaitingVerification));
        let second = ClaimedRegistration::left_in_place(registration(State::AwaitingVerification));
        let ids = [first.registration().id, second.registration().id];
        let mut prepared = Prepared::new();
        prepared.send(first, "first");
        prepared.record_decided(true);
        prepared.send(second, "second");
        prepared.record_decided(false);
        assert_eq!(prepared.sendable().len(), 2);
        let (sendable, decided) = prepared.into_parts();
        let sent: Vec<_> = sendable
            .iter()
            .map(|entry| (entry.registration_id, entry.request))
            .collect();
        assert_eq!(sent, [(ids[0], "first"), (ids[1], "second")]);
        assert_eq!(decided.processed_count(), 2);
        assert_eq!(decided.failed_count(), 1);
        assert_eq!(decided.moved_on_count(), 0);
    }
}
