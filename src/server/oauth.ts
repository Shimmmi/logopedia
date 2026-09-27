import { env } from "./env";

export type OAuthProviderId = "vk" | "yandex" | "mailru" | "esia";

export interface OAuthProfile {
  provider: OAuthProviderId;
  id: string;
  email?: string;
  name?: string;
}

export function enabledProviders() {
  const list: { id: OAuthProviderId; label: string }[] = [];
  if (env.vkClientId) list.push({ id: "vk", label: "VK ID" });
  if (env.yandexClientId) list.push({ id: "yandex", label: "Яндекс ID" });
  if (env.mailruClientId) list.push({ id: "mailru", label: "Mail.ru" });
  if (env.esiaClientId) list.push({ id: "esia", label: "Госуслуги" });
  return list;
}

function redirectUri(provider: OAuthProviderId) {
  return `${env.appUrl}/api/auth/oauth/${provider}/callback`;
}

export function authorizeUrl(provider: OAuthProviderId, state: string) {
  if (provider === "vk") {
    const u = new URL("https://id.vk.com/authorize");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", env.vkClientId);
    u.searchParams.set("redirect_uri", redirectUri("vk"));
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "email");
    return u.toString();
  }
  if (provider === "yandex") {
    const u = new URL("https://oauth.yandex.ru/authorize");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", env.yandexClientId);
    u.searchParams.set("redirect_uri", redirectUri("yandex"));
    u.searchParams.set("state", state);
    return u.toString();
  }
  if (provider === "mailru") {
    const u = new URL("https://oauth.mail.ru/login");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", env.mailruClientId);
    u.searchParams.set("redirect_uri", redirectUri("mailru"));
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "userinfo");
    return u.toString();
  }
  throw new Error("ЕСИА подключается после аккредитации ИС (этап 2)");
}

async function tokenPost(url: string, body: URLSearchParams, basic?: { id: string; secret: string }) {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (basic) {
    headers.Authorization = `Basic ${Buffer.from(`${basic.id}:${basic.secret}`).toString("base64")}`;
  }
  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`OAuth token error ${res.status}`);
  return res.json();
}

export async function exchangeCode(provider: OAuthProviderId, code: string): Promise<OAuthProfile> {
  if (provider === "vk") {
    const data = await tokenPost(
      "https://id.vk.com/oauth2/auth",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.vkClientId,
        client_secret: env.vkClientSecret,
        redirect_uri: redirectUri("vk"),
      })
    );
    const infoRes = await fetch("https://id.vk.com/oauth2/user_info", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.vkClientId, access_token: data.access_token }),
    });
    const info = await infoRes.json();
    const u = info.user ?? info;
    return {
      provider: "vk",
      id: String(u.user_id ?? u.id ?? data.user_id),
      email: u.email,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.name,
    };
  }
  if (provider === "yandex") {
    const data = await tokenPost(
      "https://oauth.yandex.ru/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.yandexClientId,
        client_secret: env.yandexClientSecret,
      })
    );
    const infoRes = await fetch("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${data.access_token}` },
    });
    const u = await infoRes.json();
    return {
      provider: "yandex",
      id: String(u.id),
      email: u.default_email,
      name: u.real_name || u.display_name,
    };
  }
  if (provider === "mailru") {
    const data = await tokenPost(
      "https://oauth.mail.ru/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.mailruClientId,
        client_secret: env.mailruClientSecret,
        redirect_uri: redirectUri("mailru"),
      })
    );
    const infoRes = await fetch(
      `https://oauth.mail.ru/userinfo?access_token=${encodeURIComponent(data.access_token)}`
    );
    const u = await infoRes.json();
    return { provider: "mailru", id: String(u.id ?? u.email), email: u.email, name: u.name };
  }
  throw new Error("ЕСИА недоступна");
}
