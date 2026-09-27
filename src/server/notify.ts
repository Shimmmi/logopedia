import { prisma } from "./db";
import { mailer } from "./mail";
import { env } from "./env";
import webpush from "web-push";

if (env.vapidPublic && env.vapidPrivate) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublic, env.vapidPrivate);
}

export async function notifyUser(userId: string, title: string, body: string, href?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { pushSubs: true },
  });
  if (!user) return;

  await prisma.notification.create({ data: { userId, title, body, href } });

  if (user.notifyPref === "EMAIL" && user.email) {
    await mailer.send({ to: user.email, subject: title, text: body }).catch((e) => console.error("mail notify", e));
  }

  if (user.notifyPref !== "NONE" && env.vapidPublic) {
    for (const sub of user.pushSubs) {
      await webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, href })
        )
        .catch(async (err) => {
          if (err?.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          }
        });
    }
  }
}
