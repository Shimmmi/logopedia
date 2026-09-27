function req(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

export const env = {
  appUrl: req("APP_URL", "http://localhost:3000"),
  nodeEnv: req("NODE_ENV", "development"),
  sessionSecret: req("SESSION_SECRET"),
  encryptionKey: req("APP_ENCRYPTION_KEY"),
  storageRoot: req("STORAGE_ROOT", "/var/www/logoped/storage"),
  devShowCodes: req("DEV_SHOW_CODES", "false") === "true",
  devUnlimited: req("DEV_UNLIMITED", "false") === "true",
  adminEmail: req("ADMIN_EMAIL", "admin@logoped.site"),
  adminPassword: req("ADMIN_PASSWORD"),
  databaseUrl: req("DATABASE_URL"),
  redisUrl: req("REDIS_URL", "redis://127.0.0.1:6379"),
  aiBaseUrl: req("AI_BASE_URL", "https://routerai.ru/api/v1"),
  aiApiKey: req("AI_API_KEY"),
  aiModelBasic: req("AI_MODEL_BASIC", "openai/gpt-4o-mini"),
  aiModelAdvanced: req("AI_MODEL_ADVANCED", "openai/gpt-4o"),
  aiImageModel: req("AI_IMAGE_MODEL", "google/gemini-3.1-flash-lite-image"),
  aiImageQuality: req("AI_IMAGE_QUALITY", "medium"),
  smtpHost: req("SMTP_HOST"),
  smtpPort: Number(req("SMTP_PORT", "465")),
  smtpUser: req("SMTP_USER"),
  smtpPass: req("SMTP_PASS"),
  smtpFrom: req("SMTP_FROM", "LogoPed <noreply@logoped.site>"),
  vkClientId: req("VK_CLIENT_ID"),
  vkClientSecret: req("VK_CLIENT_SECRET"),
  yandexClientId: req("YANDEX_CLIENT_ID"),
  yandexClientSecret: req("YANDEX_CLIENT_SECRET"),
  mailruClientId: req("MAILRU_CLIENT_ID"),
  mailruClientSecret: req("MAILRU_CLIENT_SECRET"),
  esiaClientId: req("ESIA_CLIENT_ID"),
  esiaClientSecret: req("ESIA_CLIENT_SECRET"),
  yookassaShopId: req("YOOKASSA_SHOP_ID"),
  yookassaSecret: req("YOOKASSA_SECRET_KEY"),
  smsaeroEmail: req("SMSAERO_EMAIL"),
  smsaeroKey: req("SMSAERO_API_KEY"),
  yandexSpeechKey: req("YANDEX_SPEECHKIT_KEY"),
  yandexSpeechFolder: req("YANDEX_SPEECHKIT_FOLDER"),
  vapidPublic: req("VAPID_PUBLIC_KEY"),
  vapidPrivate: req("VAPID_PRIVATE_KEY"),
  vapidSubject: req("VAPID_SUBJECT", "mailto:admin@logoped.site"),
};

export const isProd = env.nodeEnv === "production";
export const isTest = env.nodeEnv === "test";
