import MentalistScreen from "../../mentalist/MentalistScreen";

export const dynamic = "force-dynamic";
export default function Page() {
  return <MentalistScreen grade={8} initialTab="More Topics" />;
}
