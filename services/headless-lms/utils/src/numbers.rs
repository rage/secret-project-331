pub fn f32_approx_eq(first: f32, second: f32) -> bool {
    let diff = first - second;
    diff.abs() < 0.000001
}

pub fn f32_max(first: f32, second: f32) -> f32 {
    if first > second {
        first
    } else {
        second
    }
}

pub fn option_f32_to_f32_two_decimals_with_none_as_zero(value: Option<f32>) -> f32 {
    match value {
        Some(float) => f32_to_two_decimals(float),
        None => 0.0,
    }
}
pub fn f32_to_two_decimals(value: f32) -> f32 {
    (value * (100_f32)).round() / (100_f32)
}

pub fn f32_to_three_decimals(value: f32) -> f32 {
    (value * (1000_f32)).round() / (1000_f32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn f32_approx_eq_works() {
        assert!(!f32_approx_eq(1.0, 1.1));
        assert!(!f32_approx_eq(-1.1, 1.1));
        assert!(!f32_approx_eq(1.1, -1.1));
        assert!(f32_approx_eq(1.1, 1.1));
        assert!(f32_approx_eq(0.0, 0.0));
    }

    #[test]
    fn f32_to_two_decimals_works() {
        assert_eq!(f32_to_two_decimals(1.0), 1.0);
        assert_eq!(f32_to_two_decimals(1.1), 1.1);
        assert_eq!(f32_to_two_decimals(1.111_111), 1.11);
        assert_eq!(f32_to_two_decimals(1.355555), 1.36);
        assert_eq!(f32_to_two_decimals(1.000000001), 1.0);
    }

    #[test]
    fn f32_to_three_decimals_works() {
        assert_eq!(f32_to_three_decimals(1.0), 1.0);
        assert_eq!(f32_to_three_decimals(1.1), 1.1);
        assert_eq!(f32_to_three_decimals(1.111_111), 1.111);
        assert_eq!(f32_to_three_decimals(1.355555), 1.356);
        assert_eq!(f32_to_three_decimals(1.000000001), 1.0);
    }
}
