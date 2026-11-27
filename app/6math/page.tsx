import MentalistScreen from "../mentalist/MentalistScreen";

export const dynamic = "force-dynamic";
export default function Page() {
  return <MentalistScreen grade={6} initialTab="Map" />;
}
