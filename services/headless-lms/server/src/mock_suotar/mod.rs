/*!
Mock Suotar's simulator: the registry world, its store, the answer logic, faults, scenarios and
fixtures. Its routes are in `controllers::mock_suotar`.

The mock writes no database table, and its call log holds unscrubbed fake data that must never feed
`suotar_api_calls`.
*/

pub mod commands;
pub mod default_world;
pub mod faults;
pub mod fixtures;
pub mod ids;
pub mod logic;
pub mod scenarios;
pub mod store;
pub mod wire;
pub mod world;
