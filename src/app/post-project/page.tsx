import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PostProjectPage() {
  redirect("/client/post-project");
}
