import { getDashboardData } from "@/lib/sheets";

// قراءة request.url بتخلي الراوت ديناميكي، فبيتنفذ مع كل طلب من غير كاش من Next

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const data = await getDashboardData(force);
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
