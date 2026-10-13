/**
 * API Configuration for Quick Fix Frontend
 *
 * Automatically resolves backend endpoint:
 * - Uses VITE_API_URL or VITE_API_BASE_URL if set in environment
 * - In local dev (import.meta.env.DEV), defaults to http://localhost:8081/api
 * - In production (Vercel build), defaults to https://quick-fix-backend-main.onrender.com/api
 */
const fallbackUrl = import.meta.env.DEV
  ? "http://localhost:8081/api"
  : "https://quick-fix-backend-main.onrender.com/api";

const rawUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  fallbackUrl;

const cleanUrl = rawUrl.trim().replace(/\/+$/, "");

export const API = cleanUrl.endsWith("/api")
  ? cleanUrl
  : `${cleanUrl}/api`;

export default API;
