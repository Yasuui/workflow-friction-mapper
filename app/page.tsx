import type { Metadata } from "next";
import { WorkflowStudio } from "@/components/WorkflowStudio";

export const metadata: Metadata = {
  title: "Workflow Friction Mapper",
  description: "Map a manual workflow and find a safer first automation — entirely in your browser.",
};

export default function Home() {
  return <WorkflowStudio />;
}
