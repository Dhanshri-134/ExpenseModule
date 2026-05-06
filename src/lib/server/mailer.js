import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !port || !user || !pass || !from) return null;

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCredentialsEmailHtml({ name, userCode, userName, email, password, loginUrl }) {
  const safeName = escapeHtml(name);
  const safeUserCode = escapeHtml(userCode);
  const safeUserName = escapeHtml(userName);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);
  const safeLoginUrl = escapeHtml(loginUrl);

  return `
    <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#102033;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe5f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(16,32,51,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f4c81 0%,#17a2b8 55%,#7dd3fc 100%);color:#ffffff;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Project Desk Access
          </div>
          <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.2;">Your account is ready</h1>
          <p style="margin:0;font-size:15px;line-height:1.7;opacity:0.95;">
            Hello ${safeName}, your login details are below. Please sign in and change your password after your first login.
          </p>
        </div>
        <div style="padding:32px;">
          <div style="display:grid;gap:14px;">
            <div style="border:1px solid #dbe5f0;border-radius:18px;padding:16px 18px;background:#f8fbff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b7188;">User ID</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;color:#102033;">${safeUserCode}</div>
            </div>
            <div style="border:1px solid #dbe5f0;border-radius:18px;padding:16px 18px;background:#f8fbff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b7188;">User Name</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;color:#102033;">${safeUserName}</div>
            </div>
            <div style="border:1px solid #dbe5f0;border-radius:18px;padding:16px 18px;background:#f8fbff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b7188;">Email</div>
              <div style="margin-top:6px;font-size:16px;font-weight:600;color:#102033;">${safeEmail}</div>
            </div>
            <div style="border:1px solid #dbe5f0;border-radius:18px;padding:16px 18px;background:#fff8f1;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9a5c00;">Temporary Password</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;color:#7a3c00;">${safePassword}</div>
            </div>
          </div>

          <div style="margin-top:28px;">
            <a href="${safeLoginUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#0f4c81;color:#ffffff;text-decoration:none;font-weight:700;">
              Open Project Desk
            </a>
          </div>

          <div style="margin-top:24px;padding:18px;border-radius:18px;background:#eef6ff;border:1px solid #d4e6fb;">
            <div style="font-size:13px;font-weight:700;color:#0f4c81;">Security note</div>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#35506a;">
              For security, please log in as soon as possible and update this temporary password from your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildUsernameOtpEmailHtml({ name, otp, role }) {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const safeRole = escapeHtml(role);

  return `
    <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#102033;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe5f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(16,32,51,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f4c81 0%,#17a2b8 55%,#7dd3fc 100%);color:#ffffff;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Username recovery
          </div>
          <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.2;">Verification code</h1>
          <p style="margin:0;font-size:15px;line-height:1.7;opacity:0.95;">
            Hello ${safeName}, use this OTP to recover your ${safeRole} username.
          </p>
        </div>
        <div style="padding:32px;">
          <div style="border:1px solid #dbe5f0;border-radius:18px;padding:16px 18px;background:#f8fbff;text-align:center;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b7188;">OTP</div>
            <div style="margin-top:6px;font-size:30px;font-weight:800;letter-spacing:0.22em;color:#102033;">${safeOtp}</div>
          </div>
          <div style="margin-top:20px;padding:18px;border-radius:18px;background:#eef6ff;border:1px solid #d4e6fb;">
            <div style="font-size:13px;font-weight:700;color:#0f4c81;">Security note</div>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#35506a;">
              This OTP expires in 10 minutes. If you did not request it, you can ignore this email.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function createTransporter() {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error("smtp_not_configured");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  });

  await transporter.verify();

  return { transporter, smtp };
}

export async function sendCredentialsEmail({ email, name, userCode, userName, password, loginUrl }) {
  const subject = "Your Project Desk credentials";
  const text = [
    `Hello ${name},`,
    "",
    "Your Project Desk account is ready.",
    `User ID: ${userCode}`,
    `User Name: ${userName}`,
    `Email: ${email}`,
    `Password: ${password}`,
    "",
    `Login: ${loginUrl}`,
    "",
    "Please log in and change your password after first use.",
  ].join("\n");

  const { transporter, smtp } = await createTransporter();

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject,
    text,
    html: buildCredentialsEmailHtml({ name, userCode, userName, email, password, loginUrl }),
  });

  return {
    sent: true,
    mode: "smtp",
  };
}

export async function sendUsernameRecoveryOtpEmail({ email, name, otp, role }) {
  const subject = "Your ACM Desk username recovery OTP";
  const text = [
    `Hello ${name},`,
    "",
    `Use this OTP to recover your ${role} username: ${otp}`,
    "",
    "This OTP expires in 10 minutes.",
  ].join("\n");

  const { transporter, smtp } = await createTransporter();

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject,
    text,
    html: buildUsernameOtpEmailHtml({ name, otp, role }),
  });

  return {
    sent: true,
    mode: "smtp",
  };
}

export async function sendEstimateEmail({ to, subject, html, text, pdfBuffer, filename }) {
  const { transporter, smtp } = await createTransporter();

  await transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    text,
    html,
    attachments: pdfBuffer
      ? [
          {
            filename: filename || "estimate.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [],
  });

  return {
    sent: true,
    mode: "smtp",
  };
}
