use serde_json::Value;
use std::ops::Index;

#[derive(Clone, Debug)]
pub struct Json(pub Value);

impl Json {
    pub fn null() -> Self {
        Json(Value::Null)
    }

    pub fn from_slice(bytes: &[u8]) -> Result<Self, String> {
        serde_json::from_slice(bytes)
            .map(Json)
            .map_err(|e| e.to_string())
    }

    pub fn from_str(text: &str) -> Result<Self, String> {
        serde_json::from_str(text)
            .map(Json)
            .map_err(|e| e.to_string())
    }

    pub fn get(&self, key: &str) -> Json {
        match &self.0 {
            Value::Object(map) => map.get(key).cloned().map(Json).unwrap_or_else(Json::null),
            _ => Json::null(),
        }
    }

    pub fn at(&self, index: usize) -> Json {
        match &self.0 {
            Value::Array(arr) => arr.get(index).cloned().map(Json).unwrap_or_else(Json::null),
            _ => Json::null(),
        }
    }

    pub fn exists(&self) -> bool {
        !self.0.is_null()
    }

    pub fn array(&self) -> Vec<Json> {
        match &self.0 {
            Value::Array(arr) => arr.iter().cloned().map(Json).collect(),
            _ => Vec::new(),
        }
    }

    pub fn first(&self) -> Json {
        self.at(0)
    }

    pub fn last(&self) -> Json {
        match &self.0 {
            Value::Array(arr) => arr.last().cloned().map(Json).unwrap_or_else(Json::null),
            _ => Json::null(),
        }
    }

    pub fn string(&self) -> Option<String> {
        match &self.0 {
            Value::String(s) => Some(s.clone()),
            _ => None,
        }
    }

    pub fn str(&self) -> Option<&str> {
        self.0.as_str()
    }

    pub fn bool(&self) -> Option<bool> {
        match &self.0 {
            Value::Bool(b) => Some(*b),
            Value::Number(n) => n.as_i64().map(|v| v != 0),
            _ => None,
        }
    }

    pub fn int(&self) -> Option<i64> {
        match &self.0 {
            Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|f| f as i64)),
            Value::String(s) => s.parse::<i64>().ok(),
            _ => None,
        }
    }

    pub fn double(&self) -> Option<f64> {
        match &self.0 {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.parse::<f64>().ok(),
            _ => None,
        }
    }

    pub fn first_child(&self, key: &str) -> Json {
        for item in self.array() {
            let child = item.get(key);
            if child.exists() {
                return child;
            }
        }
        Json::null()
    }

    pub fn children(&self, key: &str) -> Vec<Json> {
        self.array()
            .into_iter()
            .filter_map(|item| {
                let child = item.get(key);
                if child.exists() {
                    Some(child)
                } else {
                    None
                }
            })
            .collect()
    }
}

impl Index<&str> for Json {
    type Output = Value;
    fn index(&self, key: &str) -> &Self::Output {
        static NULL: Value = Value::Null;
        match &self.0 {
            Value::Object(map) => map.get(key).unwrap_or(&NULL),
            _ => &NULL,
        }
    }
}
