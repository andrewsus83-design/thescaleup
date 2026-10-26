import { redirect } from "next/navigation";

// Score is now merged into the Dashboard.
export default function ScoreRedirect() {
  redirect("/dashboard");
}
