"use client";

export function getApiErrorMessage(error, fallback = "request_failed") {
  const payload = error?.payload;

  if (payload?.detail?.fieldErrors) {
    const fieldMessages = Object.values(payload.detail.fieldErrors).flat().filter(Boolean);
    if (fieldMessages.length) return fieldMessages[0];
  }

  if (typeof payload?.detail === "string" && payload.detail.trim()) return payload.detail;
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;

  return fallback;
}
