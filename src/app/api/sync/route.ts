import { NextResponse } from "next/server";
import { syncMarkdownDirectory } from "@/lib/markdown/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const summary = await syncMarkdownDirectory();
  return NextResponse.json(summary);
}

export async function GET() {
  return POST();
}
