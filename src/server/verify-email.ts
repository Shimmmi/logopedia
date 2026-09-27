import { randomBytes } from "crypto";
import { prisma } from "./db";
import { randomCode } from "./auth";
import { sha256 } from "./encryption";
import { sendCodeEmail } from "./mail";
import { env, isProd } from "./env";

export async function issueVerification(userId: string, email: string) {
  const code = randomCode();
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await prisma.emailCode.createMany({
    data: [
      {
        userId,
        codeHash: sha256(code),
        purpose: "verify",
        expiresAt: new Date(now + 15 * 60_000),
      },
      {
        userId,
        codeHash: sha256(token),
        purpose: "verify-link",
        expiresAt: new Date(now + 24 * 3600_000),
      },
    ],
  });
  const link = `${env.appUrl}/verify?token=${token}&email=${encodeURIComponent(email)}`;
  await sendCodeEmail(email, code, "verify", link);
  return {
    code,
    token,
    devCode: env.devShowCodes && !isProd ? code : undefined,
  };
}
