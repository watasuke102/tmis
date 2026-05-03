import { NextResponse } from "next/server";
import { z } from "zod";
import { type StatusValue, updateStatusOrder } from "@/lib/markdown/repository";
import { statusSchema, statusValues } from "@/lib/schema/frontmatter";

export const dynamic = "force-dynamic";

const statusOrderSchema = z.object({
  statusOrder: z.array(statusSchema).length(statusValues.length),
});

function hasCompleteStatusSet(values: StatusValue[]): boolean {
  if (new Set(values).size !== statusValues.length) {
    return false;
  }
  return statusValues.every((status) => values.includes(status));
}

export async function POST(request: Request) {
  const payload = statusOrderSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      {
        message: "Invalid status order payload",
        details: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!hasCompleteStatusSet(payload.data.statusOrder)) {
    return NextResponse.json(
      { message: "statusOrder must contain each status exactly once." },
      { status: 400 },
    );
  }

  updateStatusOrder(payload.data.statusOrder);
  return NextResponse.json({ ok: true });
}
