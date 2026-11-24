import { redirect } from "next/navigation";

/**
 * The old combined Users page is retired. Account management now lives on the
 * Freelancers and Clients pages, which can view and edit every account detail.
 */
export default function AdminUsersPage() {
  redirect("/admin/freelancers");
}
