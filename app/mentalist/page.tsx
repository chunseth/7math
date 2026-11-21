import Legacy from "./Legacy";
export const dynamic = "force-dynamic";
import Trail from "./Trail";
export default function Page() {
  return process.env.MENTALIST_CURRICULUM === "1" ? <Trail /> : <Legacy />;
}
