import { PrismaClient } from "@prisma/client";
import { ensureAdmin } from "../src/server/admin";
import { ensurePlanModels } from "../src/server/models";
import { PICTURE_WORDS } from "../src/data/picture-words";

const prisma = new PrismaClient();

const MATERIALS = [
  {
    title: "Чистоговорка на [Р]",
    sound: "Р",
    ageFrom: 5,
    ageTo: 8,
    kind: "чистоговорка",
    body: "Ра-ра-ра — начинается игра. Ро-ро-ро — потеряли мы перо. Ру-ру-ру — продолжаем мы игру. Ры-ры-ры — у Ромы шары.",
  },
  {
    title: "Чистоговорка на [Ш]",
    sound: "Ш",
    ageFrom: 4,
    ageTo: 7,
    kind: "чистоговорка",
    body: "Ша-ша-ша — мама моет малыша. Шу-шу-шу — помогаю малышу. Ши-ши-ши — камыши у камышей.",
  },
  {
    title: "Скороговорка на [Л]",
    sound: "Л",
    ageFrom: 5,
    ageTo: 9,
    kind: "скороговорка",
    body: "На мели мы лениво налима ловили, и меняли налима мы вам на линя.",
  },
  {
    title: "Скороговорка на [С]",
    sound: "С",
    ageFrom: 4,
    ageTo: 8,
    kind: "скороговорка",
    body: "У осы не усы, не усищи, а усики.",
  },
  {
    title: "Текст для автоматизации [Ч]",
    sound: "Ч",
    ageFrom: 5,
    ageTo: 8,
    kind: "текст",
    body: "Чебурашка чинил часы. Часы тикали: «чик-чик». Чайка чай пила на причале. Мальчик катил обруч по улице.",
  },
  {
    title: "Артикуляционная гимнастика (базовый комплекс)",
    sound: null,
    ageFrom: 4,
    ageTo: 10,
    kind: "гимнастика",
    body: "1. Улыбка — трубочка (5 раз).\n2. Лопатка — иголочка.\n3. Качели (язык вверх-вниз).\n4. Часики (влево-вправо).\n5. Вкусное варенье.\n6. Лошадка (цоканье).\nПо 5–8 повторений, перед зеркалом.",
  },
];

async function main() {
  for (const m of MATERIALS) {
    const exists = await prisma.speechMaterial.findFirst({
      where: { isSystem: true, title: m.title, userId: null },
    });
    if (!exists) {
      await prisma.speechMaterial.create({ data: { ...m, isSystem: true } });
    }
  }
  for (const w of PICTURE_WORDS) {
    const exists = await prisma.pictureWord.findFirst({
      where: { isSystem: true, userId: null, word: w.word, sound: w.sound, position: w.position },
    });
    if (!exists) await prisma.pictureWord.create({ data: { ...w, isSystem: true, verified: false } });
  }
  await ensureAdmin();
  await ensurePlanModels();
  console.log("Seed OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
