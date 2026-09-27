import { redirect } from "next/navigation";

export default function ImagesRedirect() {
  redirect("/ai?tab=pictures");
}
