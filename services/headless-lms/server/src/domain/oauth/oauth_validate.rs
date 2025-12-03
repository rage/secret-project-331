use crate::prelude::ControllerError;

pub trait OAuthValidate: Sized {
    type Output;
    fn validate(&self) -> Result<Self::Output, ControllerError>;
}
