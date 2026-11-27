import { randomUUID } from "node:crypto";
import RockPreview from "./RockPreview";
import "./rocks.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mining preview · Crafter’s Mode" };

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <RockPreview seed={randomUUID()} startedAt={Date.now()} initialView={view === "catalogue" ? "catalogue" : "mine"} />;
}
