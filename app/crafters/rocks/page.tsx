import { randomUUID } from "node:crypto";
import RockPreview from "./RockPreview";
import "./rocks.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mining preview · Crafter’s Mode" };

export default function Page() {
  return <RockPreview seed={randomUUID()} startedAt={Date.now()} />;
}
