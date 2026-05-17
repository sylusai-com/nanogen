// src/app/dashboard/create/page.js
// The dedicated /dashboard/create surface has been folded into
// /dashboard/banners (composer pinned at the top of the gallery, Ideogram-
// style). Old bookmarks and inbound links keep working via this redirect.
import { redirect } from "next/navigation";

export default function CreateRedirect() {
  redirect("/dashboard/banners");
}
