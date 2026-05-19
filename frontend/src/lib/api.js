import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;
export const WS_BASE = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const tokenKey = "ag_token";

export function setToken(t) {
  if (t) localStorage.setItem(tokenKey, t);
  else localStorage.removeItem(tokenKey);
}

export function getToken() {
  return localStorage.getItem(tokenKey);
}

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Unbekannter Fehler. Bitte erneut versuchen.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
