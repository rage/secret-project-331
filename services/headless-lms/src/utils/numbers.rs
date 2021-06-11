pub fn f32_approx_eq(first: f32, second: f32) -> bool {
    let diff = first - second;
    diff.abs() < 0.000001
}

#[cfg(test)]
mod tests {
    use crate::utils::numbers::f32_approx_eq;

    #[test]
    fn f32_approx_eq_works() {
        assert_eq!(f32_approx_eq(1.0, 1.1), false);
        assert_eq!(f32_approx_eq(-1.1, 1.1), false);
        assert_eq!(f32_approx_eq(1.1, -1.1), false);
        assert_eq!(f32_approx_eq(1.1, 1.1), true);
        assert_eq!(f32_approx_eq(0.0, 0.0), true);
    }
}
