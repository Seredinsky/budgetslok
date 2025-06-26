import axios from "axios";

/**
 * Axios instance configured for Django SessionAuthentication.
 * - baseURL: "/api/"
 * - withCredentials: true  – browser sends sessionid & csrftoken cookies.
 * - For unsafe HTTP methods (POST, PUT, PATCH, DELETE) we attach
 *   X-CSRFToken header taken from the csrftoken cookie.
 */
export const api = axios.create({
  baseURL: "/api/",
  withCredentials: true,
});

// helper: read cookie value by name
const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
};

// automatically set CSRF header on mutating requests
api.interceptors.request.use((config) => {
  const safe = ["GET", "HEAD", "OPTIONS", "TRACE"];
  const method = config.method ? config.method.toUpperCase() : "GET";
  if (!safe.includes(method)) {
    const token = getCookie("csrftoken");
    if (token) config.headers["X-CSRFToken"] = token;
  }
  return config;
});