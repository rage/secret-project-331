use crate::prelude::ControllerError;

pub trait OAuthValidate {
    fn validate(&self) -> Result<(), ControllerError>;
}
