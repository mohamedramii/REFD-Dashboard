import { getDashboardData } from "@/lib/sheets";

// Reading request.url makes the route dynamic, so it runs on every request without Next caching

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const data = await getDashboardData(force);
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
