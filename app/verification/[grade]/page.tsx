import { notFound } from "next/navigation";
import VerificationScreen from "../VerificationScreen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = await params;
  if (grade !== "6" && grade !== "7" && grade !== "8") notFound();
  return <VerificationScreen grade={grade === "6" ? 6 : grade === "7" ? 7 : 8} />;
}
