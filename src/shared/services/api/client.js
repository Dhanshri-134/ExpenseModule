"use client";

const inflightRequests = new Map();

export class ApiRequestError extends Error {
  constructor(message, response, payload = null) {
    super(message || "request_failed");
    this.name = "ApiRequestError";
    this.response = response;
    this.payload = payload;
    this.status = response?.status ?? 0;
  }
}

function buildRequestKey(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const body = typeof options.body === "string" ? options.body : "";
  return `${method}:${url}:${body}`;
}

async function parseResponsePayload(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      (typeof payload === "string" ? payload : "") ||
      "request_failed";
    throw new ApiRequestError(message, response, payload);
  }

  return payload;
}

export async function pooledGetJson(url, options = {}) {
  const key = buildRequestKey(url, { ...options, method: "GET" });
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const request = apiRequest(url, { ...options, method: "GET" }).finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, request);
  return request;
}

export async function sendJson(url, { method = "POST", body, headers, ...rest } = {}) {
  return apiRequest(url, {
    ...rest,
    method,
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
