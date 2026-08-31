import type { Metadata } from "next";
import { WorkflowStudio } from "@/components/WorkflowStudio";

export const metadata: Metadata = {
  title: "Workflow Friction Mapper",
  description: "A chat agent that reads a workflow you share and maps friction, bottlenecks, and a first move.",
};

export default function Home() {
  return <WorkflowStudio />;
}
