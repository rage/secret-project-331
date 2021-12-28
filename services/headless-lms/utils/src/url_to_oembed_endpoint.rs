use crate::UtilError;
use url::Url;

// https://github.com/WordPress/wordpress-develop/blob/master/src/wp-includes/class-wp-oembed.php
pub fn url_to_oembed_endpoint(url: String) -> Result<Url, UtilError> {
    let parsed_url = Url::parse(url.as_str())?;
    if let Some(host) = parsed_url.host_str() {
        if host.ends_with("youtu.be") || host.ends_with("youtube.com") {
            return oembed_url_builder(
                "https://www.youtube.com/oembed",
                &format!("url={}&format=json&maxwidth=780&maxheight=440", url),
            );
        }
        if host.ends_with("twitter.com") {
            return oembed_url_builder(
                "https://publish.twitter.com/oembed",
                &format!("url={}&maxwidth=780&maxheight=440", url),
            );
        }
        if host.ends_with("soundcloud.com") {
            return oembed_url_builder(
                "https://soundcloud.com/oembed",
                &format!("url={}&format=json&maxwidth=780&maxheight=440", url),
            );
        }
        if host.ends_with("open.spotify.com") || host.ends_with("play.spotify.com") {
            return oembed_url_builder(
                "https://embed.spotify.com/oembed",
                &format!("url={}&format=json&height=335&width=780", url),
            );
        }
        if host.ends_with("flickr.com") || host.ends_with("flic.kr") {
            return oembed_url_builder(
                "https://www.flickr.com/services/oembed",
                &format!("url={}&format=json&maxwidth=780&maxheight=780", url),
            );
        }
        if host.ends_with("vimeo.com") {
            return oembed_url_builder(
                "https://vimeo.com/api/oembed.json",
                &format!("url={}&maxwidth=780&maxheight=440", url),
            );
        }
        if host.ends_with("imgur.com") {
            return oembed_url_builder(
                "https://api.imgur.com/oembed",
                &format!("url={}&maxwidth=780", url),
            );
        }
        if host.ends_with("reddit.com") {
            return oembed_url_builder(
                "https://www.reddit.com/oembed",
                &format!("url={}&format=json", url),
            );
        }
        if host.ends_with("slideshare.net") {
            return oembed_url_builder(
                "https://www.slideshare.net/api/oembed/2",
                &format!("url={}&format=json", url),
            );
        }
        if host.ends_with("ted.com") {
            return oembed_url_builder(
                "https://www.ted.com/services/v1/oembed.json",
                &format!("url={}", url),
            );
        }
        if host.ends_with("tumblr.com") {
            // Old tumblr api, v2 is latest, but WP uses 1.0
            return oembed_url_builder(
                "https://www.tumblr.com/oembed/1.0",
                &format!("url={}&format=json", url),
            );
        }
        Err(UtilError::Other("Link not supported for embedding."))
    } else {
        Err(UtilError::Other("Failed to parse host from URL."))
    }
}

fn oembed_url_builder(url: &str, query_params: &str) -> Result<Url, UtilError> {
    let mut endpoint_url = Url::parse(url)?;
    endpoint_url.set_query(Some(query_params));
    Ok(endpoint_url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use url::Url;
    #[test]
    fn works_with_youtu_be() {
        assert_eq!(
            url_to_oembed_endpoint("https://youtu.be/dQw4w9WgXcQ".to_string()).unwrap(),
            Url::parse(
                "https://www.youtube.com/oembed?url=https://youtu.be/dQw4w9WgXcQ&format=json&maxwidth=780&maxheight=440"
            )
            .unwrap()
        )
    }
    #[test]
    fn works_with_youtube_com() {
        assert_eq!(
            url_to_oembed_endpoint("https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string())
                .unwrap(),
            Url::parse("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=json&maxwidth=780&maxheight=440").unwrap()
        )
    }
    #[test]
    fn works_with_youtube_com_playlist() {
        assert_eq!(
            url_to_oembed_endpoint(
                "https://www.youtube.com/playlist?list=gYLqDMMh1GEbHf-Q1".to_string()
            )
            .unwrap(),
            Url::parse("https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=gYLqDMMh1GEbHf-Q1&format=json&maxwidth=780&maxheight=440").unwrap()
        )
    }
    #[test]
    fn works_with_open_spotify_com() {
        assert_eq!(url_to_oembed_endpoint(
            "http://open.spotify.com/track/298gs9ATwKlQR".to_string()
        )
        .unwrap(),
        Url::parse("https://embed.spotify.com/oembed?url=http://open.spotify.com/track/298gs9ATwKlQR&format=json&height=335&width=780").unwrap())
    }
    #[test]
    fn works_with_flic_kr_com() {
        assert_eq!(
            url_to_oembed_endpoint("https://flic.kr/p/2jJ".to_string()).unwrap(),
            Url::parse(
                "https://www.flickr.com/services/oembed?url=https://flic.kr/p/2jJ&format=json&maxwidth=780&maxheight=780"
            ).unwrap()
        )
    }
}
