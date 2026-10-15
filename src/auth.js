async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the API server. Start the app with `npm run dev` and try again.");
  }

  if (response.status === 204) return null;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The API returned a webpage instead of JSON. Restart with `npm run dev`.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The API returned an invalid response. Check that the server is running and try again.");
  }
  if (!response.ok) {
    throw new Error(result.error || "The request could not be completed.");
  }
  return result;
}

export async function getCurrentUser() {
  const result = await request("/api/auth/me");
  return result.user;
}

export async function login(email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export async function register(email, password) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export async function getUserData() {
  const result = await request("/api/data");
  return result.data;
}

export function saveUserData(data, signal) {
  return request("/api/data", {
    method: "PUT",
    body: JSON.stringify(data),
    signal,
  });
}
