export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  phone?: string | null;
  bio?: string | null;
  location?: string | null;
  jobTitle?: string | null;
  avatarUpdatedAt?: string | null;
  emailVerifiedAt?: string | null;
};
