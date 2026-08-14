import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { processGamification } from "@/lib/gamification";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { expressionService } from "@/services/content/ExpressionService";
import { normalizeExpressionKey } from "@/services/content/ExpressionMatcher";

const schema = z.object({
  expression: z.string().min(1),
  expressionId: z.string().optional(),
  translation: z.string().min(1),
  pronunciation: z.string().optional(),
  phonetic: z.string().optional(),
  example: z.string().optional(),
  exampleTranslation: z.string().optional(),
  level: z.string().optional(),
  category: z.string().optional(),
  context: z.string().optional(),
  sourceContentId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const key = normalizeExpressionKey(body.expression);
  const catalog =
    (body.expressionId
      ? expressionService.getById(body.expressionId)
      : null) || expressionService.findBySurface(key);

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + 1);

  const existing = await prisma.userExpression.findUnique({
    where: {
      userId_expression: {
        userId: user.id,
        expression: key,
      },
    },
  });

  const item = existing
    ? await prisma.userExpression.update({
        where: { id: existing.id },
        data: {
          translation: body.translation || catalog?.translation,
          pronunciation:
            body.pronunciation || catalog?.pronunciation || undefined,
          phonetic: body.phonetic || catalog?.phonetic,
          example: body.example || catalog?.example,
          exampleTranslation:
            body.exampleTranslation || catalog?.exampleTranslation,
          context: body.context,
          sourceContentId: body.sourceContentId,
        },
      })
    : await prisma.userExpression.create({
        data: {
          userId: user.id,
          expressionId: catalog?.id || body.expressionId || `custom-${key}`,
          expression: key,
          translation: body.translation || catalog?.translation || key,
          pronunciation: body.pronunciation || catalog?.pronunciation || "",
          phonetic: body.phonetic || catalog?.phonetic,
          example: body.example || catalog?.example || "",
          exampleTranslation:
            body.exampleTranslation || catalog?.exampleTranslation || "",
          level: body.level || catalog?.level || "A1",
          category: body.category || catalog?.category || "phrase",
          sourceContentId: body.sourceContentId,
          context: body.context,
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
          status: "NEW",
          nextReviewAt,
        },
      });

  const isNew = !existing;

  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "EXPRESSION",
    itemId: item.id,
    skill: "expression",
    source: "expression_save",
    level: item.level,
    contentRef: body.sourceContentId || item.expressionId,
    context: body.context || item.example,
    dueInMinutes: 24 * 60,
    bumpDueOnUpdate: false,
    metadata: {
      expressionId: item.expressionId,
      expression: item.expression,
      category: item.category,
    },
  });

  if (isNew) {
    await analyticsService.track(user.id, "expression_saved", {
      expression: item.expression,
      expressionId: item.expressionId,
    });
  }

  const gamification = await processGamification(user.id);

  return NextResponse.json({ item, gamification, created: isNew });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const expression = url.searchParams.get("expression");
  if (expression) {
    const key = normalizeExpressionKey(expression);
    const item = await prisma.userExpression.findUnique({
      where: {
        userId_expression: { userId: user.id, expression: key },
      },
    });
    let inReviewQueue = false;
    if (item) {
      const review = await prisma.reviewItem.findUnique({
        where: {
          userId_itemType_itemId: {
            userId: user.id,
            itemType: "EXPRESSION",
            itemId: item.id,
          },
        },
      });
      inReviewQueue = Boolean(review);
    }
    return NextResponse.json({
      item,
      saved: Boolean(item),
      inReviewQueue,
      masteryScore: item?.masteryScore ?? 0,
      status: item?.status ?? null,
    });
  }

  const items = await prisma.userExpression.findMany({
    where: { userId: user.id },
    orderBy: { savedAt: "desc" },
  });
  return NextResponse.json({ items });
}
