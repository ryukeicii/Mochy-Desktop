use serde_json::{json, Value};
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct YouTubeClient {
    pub name: &'static str,
    pub version: &'static str,
    pub id: &'static str,
    pub user_agent: &'static str,
    pub os_name: Option<&'static str>,
    pub os_version: Option<&'static str>,
    pub device_make: Option<&'static str>,
    pub device_model: Option<&'static str>,
}

impl YouTubeClient {
    pub const WEB_USER_AGENT: &'static str =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

    pub const WEB_REMIX: YouTubeClient = YouTubeClient {
        name: "WEB_REMIX",
        version: "1.20260707.12.00",
        id: "67",
        user_agent: Self::WEB_USER_AGENT,
        os_name: None,
        os_version: None,
        device_make: None,
        device_model: None,
    };

    pub const WEB: YouTubeClient = YouTubeClient {
        name: "WEB",
        version: "2.20260708.00.00",
        id: "1",
        user_agent: Self::WEB_USER_AGENT,
        os_name: None,
        os_version: None,
        device_make: None,
        device_model: None,
    };

    pub const VISION_OS: YouTubeClient = YouTubeClient {
        name: "VISIONOS",
        version: "0.1",
        id: "101",
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        os_name: Some("visionOS"),
        os_version: Some("1.3.21O771"),
        device_make: Some("Apple"),
        device_model: Some("RealityDevice14,1"),
    };

    pub const IPAD_OS: YouTubeClient = YouTubeClient {
        name: "IOS",
        version: "21.03.3",
        id: "5",
        user_agent: "com.google.ios.youtube/21.03.3 (iPad7,6; U; CPU iPadOS 17_7_10 like Mac OS X; en-US)",
        os_name: Some("iPadOS"),
        os_version: Some("17.7.10.21H450"),
        device_make: Some("Apple"),
        device_model: Some("iPad7,6"),
    };

    pub fn context(&self, visitor_data: Option<&str>) -> Value {
        let mut client = json!({
            "clientName": self.name,
            "clientVersion": self.version,
            "gl": "US",
            "hl": "en",
        });
        if let Some(map) = client.as_object_mut() {
            if let Some(v) = self.os_name {
                map.insert("osName".to_string(), json!(v));
            }
            if let Some(v) = self.os_version {
                map.insert("osVersion".to_string(), json!(v));
            }
            if let Some(v) = self.device_make {
                map.insert("deviceMake".to_string(), json!(v));
            }
            if let Some(v) = self.device_model {
                map.insert("deviceModel".to_string(), json!(v));
            }
            if let Some(v) = visitor_data {
                map.insert("visitorData".to_string(), json!(v));
            }
        }
        json!({ "client": client })
    }

    pub fn stream_headers(&self) -> HashMap<String, String> {
        let mut h = HashMap::new();
        h.insert("User-Agent".to_string(), self.user_agent.to_string());
        let is_remix = self.name == "WEB_REMIX";
        h.insert(
            "Referer".to_string(),
            if is_remix {
                "https://music.youtube.com/".to_string()
            } else {
                "https://www.youtube.com/".to_string()
            },
        );
        h.insert(
            "Origin".to_string(),
            if is_remix {
                "https://music.youtube.com".to_string()
            } else {
                "https://www.youtube.com".to_string()
            },
        );
        h
    }
}
