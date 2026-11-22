import MentalistScreen from "./MentalistScreen";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <MentalistScreen initialTab={(await searchParams).tab === "inventory" ? "Collection" : "Map"} />;
}
