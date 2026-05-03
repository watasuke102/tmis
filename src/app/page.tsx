import { MarkdownDashboard } from "@/components/markdown-dashboard";
import { getDashboardData } from "@/lib/markdown/repository";

export const dynamic = "force-dynamic";

export default function Home() {
  const data = getDashboardData();

  return (
    <main className="grid min-h-screen">
      <MarkdownDashboard data={data} />
    </main>
  );
}
