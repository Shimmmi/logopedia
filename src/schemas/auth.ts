import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Не менее 8 символов")
  .refine((v) => /[A-Za-zА-Яа-я]/.test(v) && /\d/.test(v), "Нужны буквы и цифра");

export const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: passwordSchema,
  name: z.string().min(2, "Укажите имя"),
  position: z.string().optional(),
  institution: z.string().optional(),
  pdConsent: z.literal(true, { errorMap: () => ({ message: "Нужно согласие с политикой" }) }),
  timezone: z.string().min(1).max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
  remember: z.boolean().optional(),
});

export const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const resendSchema = z.object({
  email: z.string().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  password: passwordSchema,
});
