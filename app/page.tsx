import { redirect } from "next/navigation";

// For now the site is just the login: the public landing site is archived (archive/old-landing-site). An admin who is already
// logged in goes straight on to the Chat Room (the login page redirects). The report subdomain never gets here: proxy.ts maps its "/" to /report.
export default function Home() {
  redirect("/admin/login");
}
