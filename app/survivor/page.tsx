import { notFound } from "next/navigation";
import Survivor from "./Survivor";
import "./survivor.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Survivor | 7Math Arena" };

export default function Page() {
  if (process.env.MENTALIST_CURRICULUM !== "1") notFound();
  return <Survivor />;
}
