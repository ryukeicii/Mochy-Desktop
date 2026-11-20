// the wi-fi side of the link: this computer put up under a service type, and every mochy device found under one

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex};

// the names the android app registers with nsd, fully qualified the way mdns writes them
pub const PHONE_SERVICE: &str = "_mochylink._tcp.local.";
pub const PAIR_SERVICE: &str = "_mochytv._tcp.local.";

pub const ATTR_ID: &str = "id";
pub const ATTR_NAME: &str = "n";
pub const ATTR_KIND: &str = "k";

// a device found on the wi-fi, with where to reach it; kind is a tv when the device didn't say, like android reads it
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub kind: String,
}

pub struct Mdns {
    daemon: Option<ServiceDaemon>,
    // fullname -> peer, per service type
    found: Arc<Mutex<HashMap<String, HashMap<String, Peer>>>>,
    adverts: Mutex<HashMap<String, String>>,
}

impl Mdns {
    pub fn new() -> Self {
        let daemon = ServiceDaemon::new().map_err(|e| eprintln!("[link] mdns unavailable: {e}")).ok();
        Self { daemon, found: Arc::new(Mutex::new(HashMap::new())), adverts: Mutex::new(HashMap::new()) }
    }

    // keeps a live list of one service type, calling back whenever it changes
    pub fn watch(&self, service: &'static str, on_change: impl Fn() + Send + 'static) {
        let Some(daemon) = &self.daemon else { return };
        let Ok(receiver) = daemon.browse(service) else { return };
        let found = self.found.clone();
        std::thread::Builder::new()
            .name(format!("mdns-{service}"))
            .spawn(move || {
                while let Ok(event) = receiver.recv() {
                    let changed = match event {
                        ServiceEvent::ServiceResolved(info) => {
                            let host = info
                                .get_addresses_v4()
                                .into_iter()
                                .filter(|a: &Ipv4Addr| !a.is_loopback() && !a.is_link_local())
                                .min()
                                .map(|a| a.to_string());
                            let id = info.get_property_val_str(ATTR_ID).map(str::to_string);
                            match (host, id) {
                                (Some(host), Some(id)) => {
                                    let instance = info.fullname.split('.').next().unwrap_or_default().to_string();
                                    let peer = Peer {
                                        id,
                                        name: info.get_property_val_str(ATTR_NAME).map(str::to_string).unwrap_or(instance),
                                        host,
                                        port: info.port,
                                        kind: info.get_property_val_str(ATTR_KIND).unwrap_or("tv").to_string(),
                                    };
                                    let mut all = found.lock().unwrap();
                                    all.entry(service.to_string()).or_default().insert(info.fullname.clone(), peer);
                                    true
                                }
                                _ => false,
                            }
                        }
                        ServiceEvent::ServiceRemoved(_, fullname) => {
                            let mut all = found.lock().unwrap();
                            all.get_mut(service).map(|m| m.remove(&fullname).is_some()).unwrap_or(false)
                        }
                        _ => false,
                    };
                    if changed {
                        on_change();
                    }
                }
            })
            .ok();
    }

    pub fn peers(&self, service: &str) -> Vec<Peer> {
        let all = self.found.lock().unwrap();
        let mut list: Vec<Peer> = all.get(service).map(|m| m.values().cloned().collect()).unwrap_or_default();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list.dedup_by(|a, b| a.id == b.id);
        list
    }

    pub fn find(&self, service: &str, id: &str) -> Option<Peer> {
        self.peers(service).into_iter().find(|p| p.id == id)
    }

    // puts this computer on the wi-fi under a service type until withdraw is called
    pub fn advertise(&self, service: &str, instance: &str, host_label: &str, port: u16, attrs: &[(&str, &str)]) {
        let Some(daemon) = &self.daemon else { return };
        self.withdraw(service);
        let props: HashMap<String, String> = attrs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        let host = format!("{}.local.", host_label);
        let instance: String = instance.chars().take(60).collect();
        match ServiceInfo::new(service, &instance, &host, "", port, props) {
            Ok(info) => {
                let info = info.enable_addr_auto();
                let fullname = info.get_fullname().to_string();
                if daemon.register(info).is_ok() {
                    self.adverts.lock().unwrap().insert(service.to_string(), fullname);
                }
            }
            Err(e) => eprintln!("[link] couldn't advertise {service}: {e}"),
        }
    }

    pub fn withdraw(&self, service: &str) {
        let Some(daemon) = &self.daemon else { return };
        if let Some(fullname) = self.adverts.lock().unwrap().remove(service) {
            let _ = daemon.unregister(&fullname);
        }
    }
}

impl Drop for Mdns {
    fn drop(&mut self) {
        if let Some(daemon) = &self.daemon {
            let _ = daemon.shutdown();
        }
    }
}
