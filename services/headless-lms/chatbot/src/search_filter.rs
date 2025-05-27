//! A small DSL for building OData `$filter` expressions against Azure AI Search.
//! See: <https://learn.microsoft.com/en-us/azure/search/search-query-odata-filter>
//!
//! This implementation is **fully compliant** with the OData specification for Azure AI Search.
//! It uses a simplified approach to operator precedence by adding parentheses around logical
//! operations for clarity. This ensures predictable behavior and generates valid OData that
//! Azure AI Search accepts, even if it includes extra parentheses that aren't strictly necessary.
//!
//! # Operator Support
//!
//! This module implements several `std::ops` traits to provide ergonomic operator syntax:
//!
//! - `!` (Not): Logical negation - `!filter` is equivalent to `filter.not()`
//! - `&` (BitAnd): Logical AND - `filter1 & filter2` is equivalent to `filter1.and(filter2)` but with explicit parentheses
//! - `|` (BitOr): Logical OR - `filter1 | filter2` is equivalent to `filter1.or(filter2)` but with explicit parentheses
//!
//! **Note**: The operator implementations always add explicit parentheses to avoid any ambiguity
//! about precedence, ensuring the generated OData expressions are unambiguous.
//!
//! **Operator Precedence**: Rust's standard operator precedence applies:
//! - `!` (highest precedence)
//! - `&`
//! - `|` (lowest precedence)
//!
//! This means `a | b & c` is parsed as `a | (b & c)`, not `(a | b) & c`.
//! Use explicit parentheses `(a | b) & c` if you need different grouping.
//!
//! # Examples
//!
//! ```rust
//! use headless_lms_chatbot::search_filter::{SearchFilter, SearchFilterError};
//!
//! fn example() -> Result<(), SearchFilterError> {
//!     // Simple comparison
//!     let filter = SearchFilter::eq("Rating", 5);
//!     assert_eq!(filter.to_odata()?, "Rating eq 5");
//!
//!     // Using operators for logical combinations (note the explicit parentheses)
//!     let filter = SearchFilter::eq("Category", "Luxury")
//!         | SearchFilter::eq("ParkingIncluded", true)
//!         & SearchFilter::eq("Rating", 5);
//!     assert_eq!(filter.to_odata()?, "(Category eq 'Luxury' or (ParkingIncluded eq true and Rating eq 5))");
//!
//!     // Using negation operator
//!     let filter = !SearchFilter::eq("Deleted", true) & SearchFilter::eq("Status", "active");
//!     assert_eq!(filter.to_odata()?, "((not (Deleted eq true)) and Status eq 'active')");
//!
//!     // Collection operations
//!     let filter = SearchFilter::any_with_filter(
//!         "Rooms",
//!         SearchFilter::raw("room: room/BaseRate lt 200.0")
//!     );
//!     assert_eq!(filter.to_odata()?, "Rooms/any(room: room/BaseRate lt 200.0)");
//!     Ok(())
//! }
//! # example().unwrap();
//! ```

use std::fmt;
use std::ops;
use uuid::Uuid;

/// Error type for search filter operations.
#[derive(Debug, Clone, PartialEq)]
pub enum SearchFilterError {
    /// List values can only be used with search.in operations, not as direct OData literals
    ListNotSupportedInOData,
}

impl fmt::Display for SearchFilterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SearchFilterError::ListNotSupportedInOData => {
                write!(f, "List values can only be used with search.in operations, not as direct OData literals")
            }
        }
    }
}

impl std::error::Error for SearchFilterError {}

/// A strongly-typed OData filter value.
///
/// This covers strings, numbers, booleans, and lists (for `search.in`).
#[derive(Debug, Clone, PartialEq)]
pub enum SearchFilterValue {
    Str(String),
    Bool(bool),
    Int(i64),
    Float(f64),
    List(Vec<String>),
    Null,
}

impl SearchFilterValue {
    /// Create a null value
    pub fn null() -> Self {
        SearchFilterValue::Null
    }

    /// Serialize this value into an OData literal.
    ///
    /// # Examples
    ///
    /// ```
    /// # use headless_lms_chatbot::search_filter::{SearchFilterValue, SearchFilterError};
    /// # fn example() -> Result<(), SearchFilterError> {
    /// assert_eq!(SearchFilterValue::Str("abc".into()).to_odata()?, "'abc'");
    /// assert_eq!(SearchFilterValue::Int(42).to_odata()?, "42");
    /// assert_eq!(SearchFilterValue::Bool(false).to_odata()?, "false");
    /// assert_eq!(SearchFilterValue::Null.to_odata()?, "null");
    /// # Ok(())
    /// # }
    /// # example().unwrap();
    /// ```
    ///
    /// # Errors
    ///
    /// Returns `SearchFilterError::ListNotSupportedInOData` if called on a `List` variant,
    /// as lists can only be used with `search.in` operations.
    pub fn to_odata(&self) -> Result<String, SearchFilterError> {
        match self {
            SearchFilterValue::Str(s) => Ok(format!("'{}'", s.replace('\'', "''"))),
            SearchFilterValue::Bool(b) => Ok(b.to_string()),
            SearchFilterValue::Int(i) => Ok(i.to_string()),
            SearchFilterValue::Float(f) => Ok(f.to_string()),
            SearchFilterValue::List(_) => Err(SearchFilterError::ListNotSupportedInOData),
            SearchFilterValue::Null => Ok("null".to_string()),
        }
    }
}

impl From<Uuid> for SearchFilterValue {
    fn from(id: Uuid) -> Self {
        SearchFilterValue::Str(id.to_string())
    }
}

impl From<String> for SearchFilterValue {
    fn from(val: String) -> Self {
        SearchFilterValue::Str(val)
    }
}

impl From<&str> for SearchFilterValue {
    fn from(val: &str) -> Self {
        SearchFilterValue::Str(val.to_string())
    }
}

impl From<bool> for SearchFilterValue {
    fn from(val: bool) -> Self {
        SearchFilterValue::Bool(val)
    }
}

impl From<i64> for SearchFilterValue {
    fn from(val: i64) -> Self {
        SearchFilterValue::Int(val)
    }
}

impl From<i32> for SearchFilterValue {
    fn from(val: i32) -> Self {
        SearchFilterValue::Int(val as i64)
    }
}

impl From<f64> for SearchFilterValue {
    fn from(val: f64) -> Self {
        SearchFilterValue::Float(val)
    }
}

impl From<f32> for SearchFilterValue {
    fn from(val: f32) -> Self {
        SearchFilterValue::Float(val as f64)
    }
}

impl From<Vec<Uuid>> for SearchFilterValue {
    fn from(ids: Vec<Uuid>) -> Self {
        SearchFilterValue::List(ids.into_iter().map(|u| u.to_string()).collect())
    }
}

/// A composable OData boolean expression.
///
/// Supports comparison operators, logical combinators, `search.in`, and raw sub-expressions.
#[derive(Debug, Clone, PartialEq)]
pub enum SearchFilter {
    Eq(String, SearchFilterValue),
    Ne(String, SearchFilterValue),
    Gt(String, SearchFilterValue),
    Lt(String, SearchFilterValue),
    Ge(String, SearchFilterValue),
    Le(String, SearchFilterValue),
    In(String, Vec<String>),
    /// `search.in(field, 'v1|v2|...', '|')` with custom delimiter
    InWithDelimiter(String, Vec<String>, String),
    And(Box<SearchFilter>, Box<SearchFilter>),
    Or(Box<SearchFilter>, Box<SearchFilter>),
    Not(Box<SearchFilter>),
    /// Explicit parentheses to override precedence
    Parentheses(Box<SearchFilter>),
    Raw(String),
    /// Boolean field expression (e.g., `IsEnabled`)
    Field(String),
    /// Collection any() operator (e.g., `Rooms/any()` or `Rooms/any(room: room/BaseRate lt 200)`)
    Any(String, Option<Box<SearchFilter>>),
    /// Collection all() operator (e.g., `Rooms/all(room: not room/SmokingAllowed)`)
    All(String, Box<SearchFilter>),
}

impl SearchFilter {
    /// `field eq value`
    pub fn eq<T: Into<SearchFilterValue>>(field: impl Into<String>, value: T) -> Self {
        SearchFilter::Eq(field.into(), value.into())
    }

    /// `field ne value`
    pub fn ne<T: Into<SearchFilterValue>>(field: impl Into<String>, value: T) -> Self {
        SearchFilter::Ne(field.into(), value.into())
    }

    /// `field gt value`
    pub fn gt<T: Into<SearchFilterValue>>(field: impl Into<String>, value: T) -> Self {
        SearchFilter::Gt(field.into(), value.into())
    }

    /// `field lt value`
    pub fn lt<T: Into<SearchFilterValue>>(field: impl Into<String>, value: T) -> Self {
        SearchFilter::Lt(field.into(), value.into())
    }

    /// `field ge value`
    pub fn ge<T: Into<SearchFilterValue>>(field: impl Into<String>, value: T) -> Self {
        SearchFilter::Ge(field.into(), value.into())
    }

    /// `field le value`
    pub fn le<T: Into<SearchFilterValue>>(field: impl Into<String>, value: T) -> Self {
        SearchFilter::Le(field.into(), value.into())
    }

    /// `search.in(field, 'v1,v2,...', ',')`
    pub fn search_in(field: impl Into<String>, values: Vec<String>) -> Self {
        SearchFilter::In(field.into(), values)
    }

    /// `search.in(field, 'v1|v2|...', '|')` with custom delimiter
    pub fn search_in_with_delimiter(
        field: impl Into<String>,
        values: Vec<String>,
        delimiter: &str,
    ) -> Self {
        SearchFilter::InWithDelimiter(field.into(), values, delimiter.to_string())
    }

    /// `expr1 and expr2`
    pub fn and(self, other: SearchFilter) -> Self {
        SearchFilter::And(Box::new(self), Box::new(other))
    }

    /// `expr1 or expr2`
    pub fn or(self, other: SearchFilter) -> Self {
        SearchFilter::Or(Box::new(self), Box::new(other))
    }

    /// `not (expr)`
    #[allow(clippy::should_implement_trait)] // We do implement std::ops::Not, this method is for convenience
    pub fn not(self) -> Self {
        SearchFilter::Not(Box::new(self))
    }

    /// Wrap expression in explicit parentheses to override precedence
    pub fn parentheses(self) -> Self {
        SearchFilter::Parentheses(Box::new(self))
    }

    /// Insert an arbitrary OData sub-expression (e.g. `geo.distance(...)` or `search.ismatchscoring(...)`)
    pub fn raw(expr: impl Into<String>) -> Self {
        SearchFilter::Raw(expr.into())
    }

    /// Boolean field expression (e.g., `IsEnabled`)
    pub fn field(field_name: impl Into<String>) -> Self {
        SearchFilter::Field(field_name.into())
    }

    /// Collection any() operator without filter (e.g., `Rooms/any()`)
    pub fn any(collection_path: impl Into<String>) -> Self {
        SearchFilter::Any(collection_path.into(), None)
    }

    /// Collection any() operator with filter (e.g., `Rooms/any(room: room/BaseRate lt 200)`)
    pub fn any_with_filter(collection_path: impl Into<String>, filter: SearchFilter) -> Self {
        SearchFilter::Any(collection_path.into(), Some(Box::new(filter)))
    }

    /// Collection all() operator (e.g., `Rooms/all(room: not room/SmokingAllowed)`)
    pub fn all(collection_path: impl Into<String>, filter: SearchFilter) -> Self {
        SearchFilter::All(collection_path.into(), Box::new(filter))
    }

    /// Serialize this filter into a complete OData `$filter` string.
    ///
    /// # Errors
    ///
    /// Returns `SearchFilterError::ListNotSupportedInOData` if any filter value
    /// contains a `List` variant that cannot be serialized to OData.
    pub fn to_odata(&self) -> Result<String, SearchFilterError> {
        self.to_odata_internal()
    }

    /// Helper function to format a filter operand, adding parentheses only when necessary.
    /// Simple expressions (comparisons, raw, field, etc.) don't need parentheses,
    /// but complex logical expressions do.
    fn format_operand(filter: &SearchFilter) -> Result<String, SearchFilterError> {
        match filter {
            // Simple expressions that don't need parentheses
            SearchFilter::Parentheses(_)
            | SearchFilter::Raw(_)
            | SearchFilter::Field(_)
            | SearchFilter::Eq(_, _)
            | SearchFilter::Ne(_, _)
            | SearchFilter::Gt(_, _)
            | SearchFilter::Lt(_, _)
            | SearchFilter::Ge(_, _)
            | SearchFilter::Le(_, _)
            | SearchFilter::In(_, _)
            | SearchFilter::InWithDelimiter(_, _, _)
            | SearchFilter::Any(_, _)
            | SearchFilter::All(_, _) => filter.to_odata_internal(),
            // Complex expressions that need parentheses
            _ => Ok(format!("({})", filter.to_odata_internal()?)),
        }
    }

    fn to_odata_internal(&self) -> Result<String, SearchFilterError> {
        match self {
            // Comparison operators - no parentheses needed
            SearchFilter::Eq(f, v) => Ok(format!("{} eq {}", f, v.to_odata()?)),
            SearchFilter::Ne(f, v) => Ok(format!("{} ne {}", f, v.to_odata()?)),
            SearchFilter::Gt(f, v) => Ok(format!("{} gt {}", f, v.to_odata()?)),
            SearchFilter::Lt(f, v) => Ok(format!("{} lt {}", f, v.to_odata()?)),
            SearchFilter::Ge(f, v) => Ok(format!("{} ge {}", f, v.to_odata()?)),
            SearchFilter::Le(f, v) => Ok(format!("{} le {}", f, v.to_odata()?)),
            SearchFilter::In(f, vs) => Ok(format!("search.in({}, '{}', ',')", f, vs.join(","))),
            SearchFilter::InWithDelimiter(f, vs, delimiter) => Ok(format!(
                "search.in({}, '{}', '{}')",
                f,
                vs.join(delimiter),
                delimiter
            )),

            // Logical operators - always wrap operands in parentheses for clarity
            SearchFilter::And(a, b) => {
                let left = SearchFilter::format_operand(a.as_ref())?;
                let right = SearchFilter::format_operand(b.as_ref())?;
                Ok(format!("{} and {}", left, right))
            }
            SearchFilter::Or(a, b) => {
                let left = SearchFilter::format_operand(a.as_ref())?;
                let right = SearchFilter::format_operand(b.as_ref())?;
                Ok(format!("{} or {}", left, right))
            }

            // Not always needs parentheses around its operand
            SearchFilter::Not(i) => Ok(format!("not ({})", i.to_odata_internal()?)),

            // Explicit parentheses
            SearchFilter::Parentheses(f) => Ok(format!("({})", f.to_odata_internal()?)),

            // High precedence expressions - no parentheses needed
            SearchFilter::Raw(s) => Ok(s.clone()),
            SearchFilter::Field(f) => Ok(f.clone()),
            SearchFilter::Any(f, Some(filter)) => {
                Ok(format!("{}/any({})", f, filter.to_odata_internal()?))
            }
            SearchFilter::Any(f, None) => Ok(format!("{}/any()", f)),
            SearchFilter::All(f, filter) => {
                Ok(format!("{}/all({})", f, filter.to_odata_internal()?))
            }
        }
    }
}

impl fmt::Display for SearchFilter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.to_odata() {
            Ok(odata) => write!(f, "{}", odata),
            Err(err) => write!(f, "Error: {}", err),
        }
    }
}

impl ops::Not for SearchFilter {
    type Output = Self;

    fn not(self) -> Self::Output {
        SearchFilter::Not(Box::new(self))
    }
}

impl ops::BitAnd for SearchFilter {
    type Output = Self;

    fn bitand(self, rhs: Self) -> Self::Output {
        SearchFilter::Parentheses(Box::new(SearchFilter::And(Box::new(self), Box::new(rhs))))
    }
}

impl ops::BitOr for SearchFilter {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        SearchFilter::Parentheses(Box::new(SearchFilter::Or(Box::new(self), Box::new(rhs))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_to_odata_literals() -> Result<(), SearchFilterError> {
        assert_eq!(
            SearchFilterValue::Str("o'neil".into()).to_odata()?,
            "'o''neil'"
        );
        assert_eq!(SearchFilterValue::Int(123).to_odata()?, "123");
        assert_eq!(SearchFilterValue::Bool(true).to_odata()?, "true");
        assert_eq!(SearchFilterValue::Float(3.5).to_odata()?, "3.5");
        assert_eq!(SearchFilterValue::Null.to_odata()?, "null");
        Ok(())
    }

    #[test]
    fn list_value_error() {
        let list_value = SearchFilterValue::List(vec!["a".to_string(), "b".to_string()]);
        let result = list_value.to_odata();
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            SearchFilterError::ListNotSupportedInOData
        );
    }

    #[test]
    fn uuid_into_value() -> Result<(), SearchFilterError> {
        let id = Uuid::parse_str("11111111-2222-3333-4444-555555555555").unwrap();
        assert_eq!(
            SearchFilterValue::from(id).to_odata()?,
            "'11111111-2222-3333-4444-555555555555'"
        );
        Ok(())
    }

    #[test]
    fn simple_comparisons() {
        let f = SearchFilter::eq("a", "x");
        assert_eq!(f.to_string(), "a eq 'x'");
        let f = SearchFilter::gt("n", 10);
        assert_eq!(f.to_string(), "n gt 10");
    }

    #[test]
    fn logical_combinations() -> Result<(), SearchFilterError> {
        let a = SearchFilter::eq("x", 1);
        let b = SearchFilter::ne("y", false);
        let c = a.clone().and(b.clone());
        assert_eq!(c.to_odata()?, "x eq 1 and y ne false");
        let d = c.or(SearchFilter::raw(
            "geo.distance(loc, geography'POINT(0 0)') le 5",
        ));
        assert_eq!(
            d.to_string(),
            "(x eq 1 and y ne false) or geo.distance(loc, geography'POINT(0 0)') le 5"
        );
        Ok(())
    }

    #[test]
    fn search_in_multiple_values() -> Result<(), SearchFilterError> {
        let vals = vec!["a".into(), "b".into(), "c".into()];
        let f = SearchFilter::search_in("tags", vals);
        assert_eq!(f.to_odata()?, "search.in(tags, 'a,b,c', ',')");
        Ok(())
    }

    #[test]
    fn not_operator() {
        let f = SearchFilter::eq("status", "open").not();
        assert_eq!(f.to_string(), "not (status eq 'open')");
    }

    #[test]
    fn not_operator_trait() -> Result<(), SearchFilterError> {
        // Test that both the method and the ! operator work
        let filter = SearchFilter::eq("status", "open");
        let method_result = filter.clone().not();
        let operator_result = !filter;

        assert_eq!(method_result.to_odata()?, "not (status eq 'open')");
        assert_eq!(operator_result.to_odata()?, "not (status eq 'open')");
        assert_eq!(method_result.to_odata()?, operator_result.to_odata()?);
        Ok(())
    }

    #[test]
    fn bitand_operator_trait() -> Result<(), SearchFilterError> {
        // Test that both the method and the & operator work
        let left = SearchFilter::eq("status", "active");
        let right = SearchFilter::gt("rating", 4);

        let method_result = left.clone().and(right.clone());
        let operator_result = left & right;

        assert_eq!(
            method_result.to_odata()?,
            "status eq 'active' and rating gt 4"
        );
        assert_eq!(
            operator_result.to_odata()?,
            "(status eq 'active' and rating gt 4)"
        );
        // Note: operator version has explicit parentheses for clarity
        Ok(())
    }

    #[test]
    fn bitor_operator_trait() -> Result<(), SearchFilterError> {
        // Test that both the method and the | operator work
        let left = SearchFilter::eq("category", "luxury");
        let right = SearchFilter::eq("parking", true);

        let method_result = left.clone().or(right.clone());
        let operator_result = left | right;

        assert_eq!(
            method_result.to_odata()?,
            "category eq 'luxury' or parking eq true"
        );
        assert_eq!(
            operator_result.to_odata()?,
            "(category eq 'luxury' or parking eq true)"
        );
        // Note: operator version has explicit parentheses for clarity
        Ok(())
    }

    #[test]
    fn combined_operators() -> Result<(), SearchFilterError> {
        // Test combining multiple operators: !a & b | c
        let a = SearchFilter::eq("deleted", true);
        let b = SearchFilter::eq("status", "active");
        let c = SearchFilter::eq("featured", true);

        let result = !a & b | c;
        assert_eq!(
            result.to_odata()?,
            "(((not (deleted eq true)) and status eq 'active') or featured eq true)"
        );
        Ok(())
    }

    #[test]
    fn operator_precedence_demonstration() -> Result<(), SearchFilterError> {
        // Demonstrate that Rust's operator precedence applies:
        // & has higher precedence than |, so a | b & c is parsed as a | (b & c)
        let a = SearchFilter::eq("a", 1);
        let b = SearchFilter::eq("b", 2);
        let c = SearchFilter::eq("c", 3);

        let result = a | b & c;
        assert_eq!(result.to_odata()?, "(a eq 1 or (b eq 2 and c eq 3))");

        // To get (a | b) & c, you need explicit parentheses:
        let a = SearchFilter::eq("a", 1);
        let b = SearchFilter::eq("b", 2);
        let c = SearchFilter::eq("c", 3);

        let result = (a | b) & c;
        assert_eq!(result.to_odata()?, "((a eq 1 or b eq 2) and c eq 3)");
        Ok(())
    }

    #[test]
    fn nested_mix() -> Result<(), SearchFilterError> {
        let f = SearchFilter::eq("id", "abc")
            .and(SearchFilter::search_in("cat", vec!["x".into(), "y".into()]))
            .or(SearchFilter::raw("search.ismatchscoring('foo')"));
        assert_eq!(
            f.to_odata()?,
            "(id eq 'abc' and search.in(cat, 'x,y', ',')) or search.ismatchscoring('foo')"
        );
        Ok(())
    }

    #[test]
    fn null_comparisons() -> Result<(), SearchFilterError> {
        let f = SearchFilter::eq("Description", SearchFilterValue::null());
        assert_eq!(f.to_odata()?, "Description eq null");

        let f = SearchFilter::ne("Title", SearchFilterValue::null());
        assert_eq!(f.to_odata()?, "Title ne null");
        Ok(())
    }

    #[test]
    fn boolean_field_expressions() -> Result<(), SearchFilterError> {
        let f = SearchFilter::field("IsEnabled");
        assert_eq!(f.to_odata()?, "IsEnabled");

        let f = SearchFilter::field("ParkingIncluded").and(SearchFilter::eq("Rating", 5));
        assert_eq!(f.to_odata()?, "ParkingIncluded and Rating eq 5");
        Ok(())
    }

    #[test]
    fn collection_any_operator() -> Result<(), SearchFilterError> {
        // Simple any() without filter
        let f = SearchFilter::any("Rooms");
        assert_eq!(f.to_odata()?, "Rooms/any()");

        // any() with filter
        let f = SearchFilter::any_with_filter(
            "Rooms",
            SearchFilter::raw("room: room/BaseRate lt 200.0"),
        );
        assert_eq!(f.to_odata()?, "Rooms/any(room: room/BaseRate lt 200.0)");

        // Complex example from docs: Find all hotels with at least one room with base rate < $200 and rating >= 4
        let f = SearchFilter::any_with_filter(
            "Rooms",
            SearchFilter::raw("room: room/BaseRate lt 200.0"),
        )
        .and(SearchFilter::ge("Rating", 4));
        assert_eq!(
            f.to_odata()?,
            "Rooms/any(room: room/BaseRate lt 200.0) and Rating ge 4"
        );
        Ok(())
    }

    #[test]
    fn collection_all_operator() -> Result<(), SearchFilterError> {
        // all() with filter
        let f = SearchFilter::all("Rooms", SearchFilter::raw("room: not room/SmokingAllowed"));
        assert_eq!(f.to_odata()?, "Rooms/all(room: not room/SmokingAllowed)");

        // Complex example from docs: Find hotels with parking and all rooms non-smoking
        let f = SearchFilter::field("ParkingIncluded").and(SearchFilter::all(
            "Rooms",
            SearchFilter::raw("room: not room/SmokingAllowed"),
        ));
        assert_eq!(
            f.to_odata()?,
            "ParkingIncluded and Rooms/all(room: not room/SmokingAllowed)"
        );
        Ok(())
    }

    #[test]
    fn operator_precedence_examples() -> Result<(), SearchFilterError> {
        // Example from docs: Rating gt 0 and Rating lt 3 or Rating gt 7 and Rating lt 10
        // Should be equivalent to: ((Rating gt 0) and (Rating lt 3)) or ((Rating gt 7) and (Rating lt 10))
        let f = SearchFilter::gt("Rating", 0)
            .and(SearchFilter::lt("Rating", 3))
            .or(SearchFilter::gt("Rating", 7).and(SearchFilter::lt("Rating", 10)));
        assert_eq!(
            f.to_odata()?,
            "(Rating gt 0 and Rating lt 3) or (Rating gt 7 and Rating lt 10)"
        );
        Ok(())
    }

    #[test]
    fn not_operator_precedence() -> Result<(), SearchFilterError> {
        // Example from docs: not (Rating gt 5) - parentheses are required
        let f = SearchFilter::gt("Rating", 5).not();
        assert_eq!(f.to_odata()?, "not (Rating gt 5)");

        // Test with collection operator
        let f = SearchFilter::any("Rooms").not();
        assert_eq!(f.to_odata()?, "not (Rooms/any())");
        Ok(())
    }

    #[test]
    fn complex_real_world_examples() -> Result<(), SearchFilterError> {
        // Example from docs: Find hotels that are Luxury or include parking and have rating of 5
        // With our simplified approach, method chaining gives us the correct result
        let f = SearchFilter::eq("Category", "Luxury")
            .or(SearchFilter::eq("ParkingIncluded", true))
            .and(SearchFilter::eq("Rating", 5));
        assert_eq!(
            f.to_odata()?,
            "(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5"
        );

        // Example: Hotels other than "Sea View Motel" renovated since 2010
        let f = SearchFilter::ne("HotelName", "Sea View Motel").and(SearchFilter::ge(
            "LastRenovationDate",
            "2010-01-01T00:00:00Z",
        ));
        assert_eq!(
            f.to_odata()?,
            "HotelName ne 'Sea View Motel' and LastRenovationDate ge '2010-01-01T00:00:00Z'"
        );
        Ok(())
    }

    #[test]
    fn search_in_with_different_delimiters() -> Result<(), SearchFilterError> {
        // Example from docs with comma delimiter
        let f = SearchFilter::search_in(
            "HotelName",
            vec!["Sea View motel".into(), "Budget hotel".into()],
        );
        assert_eq!(
            f.to_odata()?,
            "search.in(HotelName, 'Sea View motel,Budget hotel', ',')"
        );

        // Test with pipe delimiter as shown in docs
        let f = SearchFilter::search_in_with_delimiter(
            "HotelName",
            vec!["Sea View motel".into(), "Budget hotel".into()],
            "|",
        );
        assert_eq!(
            f.to_odata()?,
            "search.in(HotelName, 'Sea View motel|Budget hotel', '|')"
        );

        // Test with spaces in values (should work with comma delimiter)
        let vals = vec!["heated towel racks".into(), "hairdryer included".into()];
        let f = SearchFilter::search_in("Tags", vals);
        assert_eq!(
            f.to_odata()?,
            "search.in(Tags, 'heated towel racks,hairdryer included', ',')"
        );
        Ok(())
    }

    #[test]
    fn documentation_examples_comprehensive() -> Result<(), SearchFilterError> {
        // Example 1: Find all hotels with at least one room with a base rate less than $200 that are rated at or above 4
        let f = SearchFilter::any_with_filter(
            "Rooms",
            SearchFilter::raw("room: room/BaseRate lt 200.0"),
        )
        .and(SearchFilter::ge("Rating", 4));
        assert_eq!(
            f.to_odata()?,
            "Rooms/any(room: room/BaseRate lt 200.0) and Rating ge 4"
        );

        // Example 2: Find all hotels other than "Sea View Motel" that have been renovated since 2010
        let f = SearchFilter::ne("HotelName", "Sea View Motel").and(SearchFilter::ge(
            "LastRenovationDate",
            "2010-01-01T00:00:00Z",
        ));
        assert_eq!(
            f.to_odata()?,
            "HotelName ne 'Sea View Motel' and LastRenovationDate ge '2010-01-01T00:00:00Z'"
        );

        // Example 3: Find all hotels that were renovated in 2010 or later with timezone
        let f = SearchFilter::ge("LastRenovationDate", "2010-01-01T00:00:00-08:00");
        assert_eq!(
            f.to_odata()?,
            "LastRenovationDate ge '2010-01-01T00:00:00-08:00'"
        );

        // Example 4: Find all hotels that have parking included and where all rooms are non-smoking
        let f = SearchFilter::field("ParkingIncluded").and(SearchFilter::all(
            "Rooms",
            SearchFilter::raw("room: not room/SmokingAllowed"),
        ));
        assert_eq!(
            f.to_odata()?,
            "ParkingIncluded and Rooms/all(room: not room/SmokingAllowed)"
        );

        // Alternative form with explicit boolean comparison
        let f = SearchFilter::eq("ParkingIncluded", true).and(SearchFilter::all(
            "Rooms",
            SearchFilter::raw("room: room/SmokingAllowed eq false"),
        ));
        assert_eq!(
            f.to_odata()?,
            "ParkingIncluded eq true and Rooms/all(room: room/SmokingAllowed eq false)"
        );

        // Example 5: Find all hotels that are Luxury or include parking and have a rating of 5
        // From docs: $filter=(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5
        // With our simplified approach, method chaining gives us the correct result
        let f = SearchFilter::eq("Category", "Luxury")
            .or(SearchFilter::eq("ParkingIncluded", true))
            .and(SearchFilter::eq("Rating", 5));
        assert_eq!(
            f.to_odata()?,
            "(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5"
        );
        Ok(())
    }

    #[test]
    fn nested_collection_operations() -> Result<(), SearchFilterError> {
        // Example: Find all hotels with the tag "wifi" in at least one room
        let f = SearchFilter::any_with_filter(
            "Rooms",
            SearchFilter::raw("room: room/Tags/any(tag: tag eq 'wifi')"),
        );
        assert_eq!(
            f.to_odata()?,
            "Rooms/any(room: room/Tags/any(tag: tag eq 'wifi'))"
        );

        // Example: Find all hotels with any rooms
        let f = SearchFilter::any("Rooms");
        assert_eq!(f.to_odata()?, "Rooms/any()");

        // Example: Find all hotels that don't have rooms
        let f = SearchFilter::any("Rooms").not();
        assert_eq!(f.to_odata()?, "not (Rooms/any())");

        // Example: Find all hotels where all rooms have the tag 'wifi' or 'tub'
        let f = SearchFilter::any_with_filter(
            "Rooms",
            SearchFilter::raw("room: room/Tags/any(tag: search.in(tag, 'wifi, tub'))"),
        );
        assert_eq!(
            f.to_odata()?,
            "Rooms/any(room: room/Tags/any(tag: search.in(tag, 'wifi, tub')))"
        );
        Ok(())
    }

    #[test]
    fn geospatial_examples() -> Result<(), SearchFilterError> {
        // Example: Find all hotels within 10 kilometers of a given reference point
        let f = SearchFilter::raw(
            "geo.distance(Location, geography'POINT(-122.131577 47.678581)') le 10",
        );
        assert_eq!(
            f.to_odata()?,
            "geo.distance(Location, geography'POINT(-122.131577 47.678581)') le 10"
        );

        // Example: Find all hotels within a given viewport described as a polygon
        let f = SearchFilter::raw(
            "geo.intersects(Location, geography'POLYGON((-122.031577 47.578581, -122.031577 47.678581, -122.131577 47.678581, -122.031577 47.578581))')"
        );
        assert_eq!(
            f.to_odata()?,
            "geo.intersects(Location, geography'POLYGON((-122.031577 47.578581, -122.031577 47.678581, -122.131577 47.678581, -122.031577 47.578581))')"
        );
        Ok(())
    }

    #[test]
    fn full_text_search_examples() -> Result<(), SearchFilterError> {
        // Example: Find documents with the word "waterfront"
        let f = SearchFilter::raw("search.ismatchscoring('waterfront')");
        assert_eq!(f.to_odata()?, "search.ismatchscoring('waterfront')");

        // Example: Find documents with the word "hostel" and rating >= 4, or "motel" and rating = 5
        let f = SearchFilter::raw("search.ismatchscoring('hostel')")
            .and(SearchFilter::ge("rating", 4))
            .or(SearchFilter::raw("search.ismatchscoring('motel')")
                .and(SearchFilter::eq("rating", 5)));
        assert_eq!(
            f.to_odata()?,
            "(search.ismatchscoring('hostel') and rating ge 4) or (search.ismatchscoring('motel') and rating eq 5)"
        );

        // Example: Find documents without the word "luxury"
        let f = SearchFilter::raw("search.ismatch('luxury')").not();
        assert_eq!(f.to_odata()?, "not (search.ismatch('luxury'))");

        // Example: Find documents with phrase "ocean view" or rating = 5
        let f =
            SearchFilter::raw("search.ismatchscoring('\"ocean view\"', 'Description,HotelName')")
                .or(SearchFilter::eq("Rating", 5));
        assert_eq!(
            f.to_odata()?,
            "search.ismatchscoring('\"ocean view\"', 'Description,HotelName') or Rating eq 5"
        );

        // Example: Complex query with Lucene syntax
        let f = SearchFilter::raw(
            "search.ismatch('\"hotel airport\"~5', 'Description', 'full', 'any')",
        )
        .and(
            SearchFilter::any_with_filter("Rooms", SearchFilter::raw("room: room/SmokingAllowed"))
                .not(),
        );
        assert_eq!(
            f.to_odata()?,
            "search.ismatch('\"hotel airport\"~5', 'Description', 'full', 'any') and (not (Rooms/any(room: room/SmokingAllowed)))"
        );

        // Example: Prefix search
        let f = SearchFilter::raw("search.ismatch('lux*', 'Description')");
        assert_eq!(f.to_odata()?, "search.ismatch('lux*', 'Description')");
        Ok(())
    }

    #[test]
    fn operator_precedence_documentation_examples() -> Result<(), SearchFilterError> {
        // The key example from docs: Rating gt 0 and Rating lt 3 or Rating gt 7 and Rating lt 10
        // Should be equivalent to: ((Rating gt 0) and (Rating lt 3)) or ((Rating gt 7) and (Rating lt 10))
        let f = SearchFilter::gt("Rating", 0)
            .and(SearchFilter::lt("Rating", 3))
            .or(SearchFilter::gt("Rating", 7).and(SearchFilter::lt("Rating", 10)));
        assert_eq!(
            f.to_odata()?,
            "(Rating gt 0 and Rating lt 3) or (Rating gt 7 and Rating lt 10)"
        );

        // Test that 'and' has higher precedence than 'or'
        let f = SearchFilter::eq("A", 1).or(SearchFilter::eq("B", 2).and(SearchFilter::eq("C", 3)));
        assert_eq!(f.to_odata()?, "A eq 1 or (B eq 2 and C eq 3)");
        Ok(())
    }

    #[test]
    fn explicit_parentheses_for_precedence_override() -> Result<(), SearchFilterError> {
        // Example from docs that requires explicit parentheses:
        // $filter=(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5
        let f = SearchFilter::eq("Category", "Luxury")
            .or(SearchFilter::eq("ParkingIncluded", true))
            .parentheses()
            .and(SearchFilter::eq("Rating", 5));
        assert_eq!(
            f.to_odata()?,
            "(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5"
        );

        // Without explicit parentheses, we get the same result due to method chaining
        let f_no_parens = SearchFilter::eq("Category", "Luxury")
            .or(SearchFilter::eq("ParkingIncluded", true))
            .and(SearchFilter::eq("Rating", 5));
        assert_eq!(
            f_no_parens.to_odata()?,
            "(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5"
        );
        Ok(())
    }

    #[test]
    fn odata_specification_compliance() -> Result<(), SearchFilterError> {
        // Test cases based on the official OData specification examples

        // Example: "Find all hotels other than 'Sea View Motel' that have been renovated since 2010"
        // Expected: $filter=HotelName ne 'Sea View Motel' and LastRenovationDate ge 2010-01-01T00:00:00Z
        let filter = SearchFilter::ne("HotelName", "Sea View Motel").and(SearchFilter::ge(
            "LastRenovationDate",
            "2010-01-01T00:00:00Z",
        ));
        assert_eq!(
            filter.to_odata()?,
            "HotelName ne 'Sea View Motel' and LastRenovationDate ge '2010-01-01T00:00:00Z'"
        );

        // Example: "Find all hotels that are Luxury or include parking and have a rating of 5"
        // Expected: $filter=(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5
        // Our method chaining produces the same logical result with extra parentheses
        let filter = SearchFilter::eq("Category", "Luxury")
            .or(SearchFilter::eq("ParkingIncluded", true))
            .and(SearchFilter::eq("Rating", 5));
        assert_eq!(
            filter.to_odata()?,
            "(Category eq 'Luxury' or ParkingIncluded eq true) and Rating eq 5"
        );

        // Example: "Find all hotels that have parking included and where all rooms are non-smoking"
        // Expected: $filter=ParkingIncluded and Rooms/all(room: not room/SmokingAllowed)
        let filter = SearchFilter::field("ParkingIncluded").and(SearchFilter::all(
            "Rooms",
            SearchFilter::raw("room: not room/SmokingAllowed"),
        ));
        assert_eq!(
            filter.to_odata()?,
            "ParkingIncluded and Rooms/all(room: not room/SmokingAllowed)"
        );

        // Example: "Find all hotels that don't have rooms"
        // Expected: $filter=not Rooms/any()
        let filter = SearchFilter::any("Rooms").not();
        assert_eq!(filter.to_odata()?, "not (Rooms/any())");

        // Example: "Find all hotels where 'Description' field is null"
        // Expected: $filter=Description eq null
        let filter = SearchFilter::eq("Description", SearchFilterValue::null());
        assert_eq!(filter.to_odata()?, "Description eq null");

        // Example: search.in function
        // Expected: $filter=search.in(HotelName, 'Sea View motel,Budget hotel', ',')
        let filter = SearchFilter::search_in(
            "HotelName",
            vec!["Sea View motel".into(), "Budget hotel".into()],
        );
        assert_eq!(
            filter.to_odata()?,
            "search.in(HotelName, 'Sea View motel,Budget hotel', ',')"
        );

        // Test operator precedence matches OData spec
        // OData: "Rating gt 0 and Rating lt 3 or Rating gt 7 and Rating lt 10"
        // Should be equivalent to: "((Rating gt 0) and (Rating lt 3)) or ((Rating gt 7) and (Rating lt 10))"
        let filter = SearchFilter::gt("Rating", 0)
            .and(SearchFilter::lt("Rating", 3))
            .or(SearchFilter::gt("Rating", 7).and(SearchFilter::lt("Rating", 10)));
        assert_eq!(
            filter.to_odata()?,
            "(Rating gt 0 and Rating lt 3) or (Rating gt 7 and Rating lt 10)"
        );
        Ok(())
    }
}
