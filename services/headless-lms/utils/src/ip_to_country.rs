use std::{collections::HashMap, io::Read, net::IpAddr, path::Path, time::Instant};

use std::env;

use anyhow;
use anyhow::bail;
use flate2::read::GzDecoder;
use ipnet::IpNet;
use walkdir::WalkDir;

use headless_lms_base::config::ApplicationConfiguration;

/// IPFire location codes that flag networks (anonymous proxies, satellite providers, anycast,
/// hostile) rather than name a country. Their lists overlap the countries' lists, and with them
/// loaded a lookup would depend on hash map iteration order.
const NON_COUNTRY_CODES: [&str; 4] = ["A1", "A2", "A3", "XD"];

pub struct IpToCountryMapper {
    lists: HashMap<String, Vec<ipnet::IpNet>>,
}

impl IpToCountryMapper {
    /**
    Creates a new mapper by reading the folder from env IP_TO_COUNTRY_MAPPING_DIRECTORY

    Expensive and synchronous.
    */
    pub fn new(app_conf: &ApplicationConfiguration) -> anyhow::Result<Self> {
        let mut lists = HashMap::new();
        if let Ok(ip_to_country_mapping_directory) = env::var("IP_TO_COUNTRY_MAPPING_DIRECTORY") {
            info!("Loading country to ip mapping");
            let start = Instant::now();
            let path = Path::new(&ip_to_country_mapping_directory);
            if !path.exists() {
                bail!("The folder specified in IP_TO_COUNTRY_MAPPING_DIRECTORY does not exist.");
            }
            let walker = WalkDir::new(path)
                .follow_links(false)
                .max_open(10)
                .contents_first(false)
                .sort_by_file_name();
            let mut some_lists_skipped = false;
            for entry_result in walker {
                let entry = entry_result?;
                if !entry.file_type().is_file() {
                    continue;
                }
                let file_name = entry.file_name().to_string_lossy();
                let mut parts = if file_name.contains("v4") {
                    file_name.split("v4")
                } else {
                    file_name.split("v6")
                };

                // Speed up loading only in bin/dev
                if app_conf.test_mode
                    && cfg!(debug_assertions)
                    && lists.len() > 10
                    && !file_name.to_lowercase().contains("fi")
                {
                    some_lists_skipped = true;
                    continue;
                }

                if let Some(country_code) = parts.next() {
                    if NON_COUNTRY_CODES.contains(&country_code.to_uppercase().as_str()) {
                        continue;
                    }
                    let list = lists
                        .entry(country_code.to_lowercase())
                        .or_insert_with(Vec::new);
                    let path = entry.path();
                    let bytes = std::fs::read(path)?;
                    // The file is gzipped in the dockerfile to save space.
                    let mut gz = GzDecoder::new(&bytes[..]);
                    let mut contents = String::new();
                    gz.read_to_string(&mut contents)?;
                    for line in contents.trim().lines() {
                        if let Ok(ipnet) = line.parse::<IpNet>() {
                            list.push(ipnet);

                            if cfg!(debug_assertions) && (list.len() > 10) {
                                some_lists_skipped = true;
                                break;
                            }
                        }
                    }
                }
            }
            info!(
                elapsed_time = ?start.elapsed(),
                "Loaded ip to country mappings"
            );
            if some_lists_skipped {
                warn!(
                    "Some ip to country lists were skipped to speed up loading. This should not happen in production."
                );
            }
        } else {
            warn!(
                "IP_TO_COUNTRY_MAPPING_DIRECTORY not specified, not loading ip to country mappings."
            );
        }

        // The staff session check compares countries, and treats an address without one as a
        // single-address network, so running without lists would quietly weaken it.
        if lists.values().all(Vec::is_empty)
            && !app_conf.test_mode
            && !app_conf.development_uuid_login
        {
            bail!(
                "No ip to country mappings loaded. Set IP_TO_COUNTRY_MAPPING_DIRECTORY to a folder with the lists."
            );
        }

        Ok(Self { lists })
    }

    pub fn map_ip_to_country(&self, ip: &IpAddr) -> Option<&str> {
        let country = self.find_country(ip);
        match country {
            Some(country) => info!("Mapped ip {} to country {}.", ip, country),
            None => info!("Ip {} did not resolve to a country.", ip),
        }
        country
    }

    /// [`Self::map_ip_to_country`] logging only at debug level, for callers that look up on every
    /// request of a session.
    pub fn map_ip_to_country_quietly(&self, ip: &IpAddr) -> Option<&str> {
        let country = self.find_country(ip);
        debug!(?ip, ?country, "Mapped ip to country");
        country
    }

    fn find_country(&self, ip: &IpAddr) -> Option<&str> {
        self.lists
            .iter()
            .find(|(_, list)| list.iter().any(|ipnet| ipnet.contains(ip)))
            .map(|(country, _)| country.as_str())
    }
}
