export const dynamic = "force-dynamic";
import Game from "./Game";
export default function Page() {
  return <Game secure={process.env.MENTALIST_CURRICULUM === "1"} />;
}
