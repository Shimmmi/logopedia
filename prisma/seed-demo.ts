import { PrismaClient } from "@prisma/client";
import { provisionUser, hashPassword } from "../src/server/auth";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEMO !== "1") {
    console.log("Set SEED_DEMO=1 to create demo data");
    return;
  }
  const email = "demo@logoped.site";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await provisionUser({
      email,
      name: "Демо Логопед",
      passwordHash: await hashPassword("Demo12345"),
      emailVerifiedAt: new Date(),
      pdConsentAt: new Date(),
    });
  }
  const names = [
    "Иванова Мария Александровна",
    "Петров Артём Сергеевич",
    "Сидорова Анна Павловна",
    "Кузнецов Иван Дмитриевич",
    "Смирнова Елизавета Игоревна",
  ];
  for (const fullName of names) {
    const exists = await prisma.pupil.findFirst({ where: { userId: user.id, fullName } });
    if (!exists) {
      await prisma.pupil.create({
        data: { userId: user.id, fullName, grade: "2", school: "МБОУ СОШ №1", status: "ACTIVE" },
      });
    }
  }
  console.log("Demo seed OK", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
