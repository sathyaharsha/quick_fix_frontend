/**
 * API Configuration for Quick Fix Frontend
 *
 * Supports VITE_API_URL (standard) and VITE_API_BASE_URL.
 * Automatically normalizes paths so trailing /api is handled consistently.
 * In development, defaults to local backend http://localhost:8081/api.
 */
const rawUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8081/api";

const cleanUrl = rawUrl.trim().replace(/\/+$/, "");

export const API = cleanUrl.endsWith("/api")
  ? cleanUrl
  : `${cleanUrl}/api`;

export default API;
