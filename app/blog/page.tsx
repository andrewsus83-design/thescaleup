import { permanentRedirect } from "next/navigation";

// Blog has moved to ScaleHub — keep old links working (301).
export default function BlogIndexRedirect() {
  permanentRedirect("/scalehub");
}
