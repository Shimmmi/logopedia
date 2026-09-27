export const PUPIL_STATUS: Record<string, string> = {
  ACTIVE: "Занимается",
  PAUSED: "Пауза",
  GRADUATED: "Выпущен",
  ARCHIVE: "В архиве",
};

export const GENDER: Record<string, string> = {
  MALE: "Мальчик",
  FEMALE: "Девочка",
  OTHER: "Не указан",
};

export const EVENT_TYPE: Record<string, string> = {
  DIAGNOSTICS: "Диагностика",
  INDIVIDUAL: "Индивидуальное",
  GROUP: "Групповое",
  CONSULTATION: "Консультация",
};

export const EVENT_STATUS: Record<string, string> = {
  SCHEDULED: "Запланировано",
  COMPLETED: "Проведено",
  CANCELED: "Отменено",
  ABSENT: "Не пришёл",
  RESCHEDULED: "Перенесено",
};

export const TAG_CATEGORY: Record<string, string> = {
  DIAGNOSIS: "Диагноз",
  DIRECTION: "Направление",
  ORGANIZATIONAL: "Организация",
  CUSTOM: "Свой",
};

export const GENERATION_KIND: Record<string, string> = {
  DIAGNOSTICS: "Диагностика",
  PROGRAM: "Рабочая программа",
  CONCLUSION: "Заключение",
  TASKS: "Задания",
};

export const PLAN_LABELS: Record<string, string> = {
  FREE: "Бесплатный",
  PRO: "Профессиональный",
  PREMIUM: "Премиум",
};

export const FILE_KIND: Record<string, string> = {
  DOC: "Документ",
  AUDIO: "Аудио",
  IMAGE: "Изображение",
  OTHER: "Файл",
  PMPK: "Заключение ПМПК",
};

export const LIBRARY_KIND: Record<string, string> = {
  text: "Текст",
  чистоговорка: "Чистоговорка",
  скороговорка: "Скороговорка",
  гимнастика: "Гимнастика",
  TONGUE_TWISTER: "Скороговорка",
};

export const POSITION_OPTIONS = [
  "Учитель-логопед",
  "Дефектолог",
  "Педагог-психолог",
  "Другое",
] as const;

export const CONTACT_ROLES = ["Мама", "Папа", "Опекун", "Бабушка", "Дедушка", "Другое"] as const;

export const PROGRESS_AREAS = [
  { id: "sound", label: "Звукопроизношение" },
  { id: "lexis", label: "Лексика" },
  { id: "grammar", label: "Грамматика" },
  { id: "connected", label: "Связная речь" },
  { id: "reading", label: "Чтение и письмо" },
] as const;

export function labelOf(map: Record<string, string>, value?: string | null) {
  if (!value) return "—";
  return map[value] ?? value;
}
