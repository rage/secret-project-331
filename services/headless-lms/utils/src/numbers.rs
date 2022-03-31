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

pub fn option_f32_to_f32_two_decimals(value: Option<f32>) -> f32 {
    match value {
        Some(float) => f32_to_two_decimals(float),
        None => 0.0,
    }
}
pub fn f32_to_two_decimals(value: f32) -> f32 {
    (value * (100_f32)).trunc() / (100_f32)
}

#[cfg(test)]
mod tests {
    use crate::numbers::f32_approx_eq;

    #[test]
    fn f32_approx_eq_works() {
        assert_eq!(f32_approx_eq(1.0, 1.1), false);
        assert_eq!(f32_approx_eq(-1.1, 1.1), false);
        assert_eq!(f32_approx_eq(1.1, -1.1), false);
        assert_eq!(f32_approx_eq(1.1, 1.1), true);
        assert_eq!(f32_approx_eq(0.0, 0.0), true);
    }
}
