import { SettingsScreen } from "@/components/room/settings-screen";
import { loadRoomKeys, loadWorkspaceCostProfile } from "@/lib/room/key-actions";

export default async function SettingsPage() {
  const [initialKeys, initialCost] = await Promise.all([loadRoomKeys(), loadWorkspaceCostProfile()]);
  return <SettingsScreen initialKeys={initialKeys} initialCost={initialCost} />;
}
