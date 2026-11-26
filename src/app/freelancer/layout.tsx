import type { ReactNode } from "react";
import { QueryProvider } from "@/components/layout/query-provider";

export default function FreelancerLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
