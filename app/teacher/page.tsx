import Legacy from "./Legacy";
export const dynamic = "force-dynamic";
import School from "./School";
export default function Page() {
  return process.env.MENTALIST_CURRICULUM === "1" ? <School /> : <Legacy />;
}
