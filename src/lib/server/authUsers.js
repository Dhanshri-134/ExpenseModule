const AUTH_USERS_TTL_MS = 30_000;

let authUsersCache = {
  users: null,
  expiresAt: 0,
  promise: null,
};

async function loadAllAuthUsers(admin) {
  const users = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const response = await admin.auth.admin.listUsers({ page, perPage });
    const nextUsers = response.data?.users ?? [];
    users.push(...nextUsers);

    if (nextUsers.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function listAuthUsersCached(admin, options = {}) {
  const { force = false } = options;
  const isFresh = authUsersCache.users && Date.now() < authUsersCache.expiresAt;

  if (!force && isFresh) {
    return authUsersCache.users;
  }

  if (!force && authUsersCache.promise) {
    return authUsersCache.promise;
  }

  authUsersCache.promise = (async () => {
    const users = await loadAllAuthUsers(admin);
    authUsersCache = {
      users,
      expiresAt: Date.now() + AUTH_USERS_TTL_MS,
      promise: null,
    };
    return users;
  })();

  try {
    return await authUsersCache.promise;
  } catch (error) {
    authUsersCache.promise = null;
    throw error;
  }
}

export async function getAuthUsersMap(admin, options = {}) {
  const users = await listAuthUsersCached(admin, options);
  return new Map(users.map((user) => [user.id, user]));
}

export function invalidateAuthUsersCache() {
  authUsersCache = {
    users: null,
    expiresAt: 0,
    promise: null,
  };
}
