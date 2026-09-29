//! What a phase iteration did, as the phase-state row and the batch summaries report it.

use uuid::Uuid;

use super::decision::Applied;

/// What a phase body did. Composite phases add up their flows' counts with `+=`.
///
/// `failed` and `waiting` are disjoint parts of `processed`: each is counted only with the row, or
/// module, it describes.
#[derive(Debug, Default)]
pub(crate) struct Counts {
    processed: i32,
    /// Rows written with an answer that only means "not yet", such as an enrolment not made.
    waiting: i32,
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
        self.record_verdict(is_failure, false);
    }

    fn record_verdict(&mut self, is_failure: bool, is_waiting: bool) {
        self.processed += 1;
        self.failed += i32::from(is_failure);
        self.waiting += i32::from(is_waiting);
    }

    /// One answered or refused row's write. A row that had already moved on is only logged at debug:
    /// the batch summary reports it, and a study registry outage can make it routine.
    pub(crate) fn record_applied(&mut self, registration_id: Uuid, applied: Applied) {
        match applied {
            Applied::Written {
                is_failure,
                is_waiting,
            } => self.record_verdict(is_failure, is_waiting),
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

    /// How many of the processed ones ended up waiting for something, which is no failure.
    pub(crate) fn waiting_count(&self) -> i32 {
        self.waiting
    }

    /// How many of the processed ones ended up carrying an error code other than a waiting one.
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
        self.waiting += other.waiting;
        self.failed += other.failed;
        self.moved_on += other.moved_on;
        self.finding = self.finding.take().or(other.finding);
    }
}

#[cfg(test)]
mod tests {
    use headless_lms_models::credit_registrations::CreditRegistrationState as State;

    use super::*;

    fn written(is_failure: bool) -> Applied {
        Applied::Written {
            is_failure,
            is_waiting: false,
        }
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
}
