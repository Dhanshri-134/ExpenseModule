export function sendError(res, status, error, detail = null) {
  return res.status(status).json({ ok: false, error, detail });
}

export function sendOk(res, payload = {}) {
  return res.status(200).json({ ok: true, ...payload });
}

