import crypto from "node:crypto";

export function makeTemporaryPassword() {
  return `Shris@${crypto.randomBytes(4).toString("hex")}9`;
}

export async function createAuthUser(admin, { email, name, userName, mobile, password }) {
  const temporaryPassword = password || makeTemporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      name,
      full_name: name,
      user_name: userName,
      mobile_no: mobile ?? "",
    },
  });

  if (error || !data?.user) {
    throw new Error(error?.message || "Unable to create auth user");
  }

  return { user: data.user, temporaryPassword };
}

export async function upsertDemoCredential(admin, { companyId, userId, email, password }) {
  const { error } = await admin
    .from("demo_user_credentials")
    .upsert({
      user_id: userId,
      company_id: companyId,
      email,
      password,
    });

  if (error) {
    throw new Error(error.message || "Unable to store demo credentials");
  }
}
