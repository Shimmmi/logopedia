import { prisma } from "./db";

export async function audit(params: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      meta: params.meta as object | undefined,
    },
  });
}
