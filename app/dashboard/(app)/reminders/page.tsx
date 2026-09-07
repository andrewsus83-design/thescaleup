import { redirect } from "next/navigation";

// Reminders are now merged into the Calendar.
export default function RemindersRedirect() {
  redirect("/dashboard/calendar");
}
