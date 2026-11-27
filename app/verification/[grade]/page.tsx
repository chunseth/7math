import { notFound, redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = await params;
  if (grade !== "6" && grade !== "7" && grade !== "8") notFound();
  redirect("/verification");
}
