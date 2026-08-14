import { NextResponse } from "next/server";
import { expressionService } from "@/services/content/ExpressionService";

export async function GET() {
  return NextResponse.json({
    expressions: expressionService.listCatalog(),
  });
}
