import { SettingsScreen } from "@/components/room/settings-screen";
import { loadRoomKeys } from "@/lib/room/key-actions";

export default async function SettingsPage() {
  const initialKeys = await loadRoomKeys();
  return <SettingsScreen initialKeys={initialKeys} />;
}
