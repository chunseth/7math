import Legacy from "./Legacy";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
export default function Page() {
  if (process.env.MENTALIST_CURRICULUM === "1") redirect("/mentalist");
  return <Legacy />;
}
