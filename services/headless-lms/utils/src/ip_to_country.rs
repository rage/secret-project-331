use std::{collections::HashMap, io::Read, net::IpAddr, path::Path, time::Instant};

use std::env;

use anyhow;
use anyhow::bail;
use flate2::read::GzDecoder;
use ipnet::IpNet;
use walkdir::WalkDir;

pub struct IpToCountryMapper {
    lists: HashMap<String, Vec<ipnet::IpNet>>,
}

impl IpToCountryMapper {
    /**
    Creates a new mapper by reading the folder from env IP_TO_COUNTRY_MAPPING_DIRECTORY

    Expensive and synchronous.
    */
    pub fn new() -> anyhow::Result<Self> {
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
                if let Some(country_code) = parts.next() {
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
                            // Speed up loading only in bin/dev
                            if cfg!(debug_assertions) && (list.len() > 10) {
                                break;
                            }
                        }
                    }
                }
                // Speed up loading only in bin/dev
                if cfg!(debug_assertions) && lists.len() > 10 {
                    break;
                }
            }
            info!(
                elapsed_time = ?start.elapsed(),
                "Loaded country to ip mapping"
            );
        } else {
            warn!(
                "IP_TO_COUNTRY_MAPPING_DIRECTORY not specified, not loading ip to country mappings."
            );
            // Not failing to allow running the backend without the lists
        }

        Ok(Self { lists })
    }

    pub fn map_ip_to_country(&self, ip: &IpAddr) -> Option<&str> {
        for (country, list) in &self.lists {
            if list.iter().any(|ipnet| ipnet.contains(ip)) {
                return Some(country);
            }
        }
        None
    }
}
