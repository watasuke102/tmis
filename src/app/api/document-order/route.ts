import { NextResponse } from "next/server";
import { z } from "zod";
import { updateDocumentOrder } from "@/lib/markdown/repository";
import { statusSchema } from "@/lib/schema/frontmatter";

export const dynamic = "force-dynamic";

const documentOrderSchema = z.object({
  status: statusSchema,
  orderedFilePaths: z.array(z.string().min(1)),
});

export async function POST(request: Request) {
  const payload = documentOrderSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      {
        message: "Invalid document order payload",
        details: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    updateDocumentOrder(payload.data.status, payload.data.orderedFilePaths);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update document order";
    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
