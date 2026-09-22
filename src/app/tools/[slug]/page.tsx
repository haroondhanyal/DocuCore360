import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, ArrowLeft, Clock3 } from "lucide-react";
import { findTool } from "@/config/tools";
import { ToolIcon } from "@/components/tool-icon";
import { ToolClient } from "@/components/pdf/tool-client";
import { Button } from "@/components/ui/button";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const tool = findTool((await params).slug);
  return {
    title: tool?.name ?? "Tool not found",
    description: tool?.description,
    openGraph: { title: tool?.name, description: tool?.description },
  };
}
export default async function Page({ params }: Props) {
  const tool = findTool((await params).slug);
  if (!tool) notFound();
  return (
    <>
      <Link href="/tools" className="inline-flex items-center gap-2 text-[11px] muted mb-6">
        <ArrowLeft size={13} />
        All tools
      </Link>
      <div className="page-intro tool-intro">
        <div className="tool-heading">
          <span className={`tool-icon ${tool.color}`}>
            <ToolIcon name={tool.icon} size={28} />
          </span>
          <div>
            <h1>{tool.name}</h1>
            <p>{tool.description}</p>
          </div>
        </div>
        <span className="tool-badge">
          {tool.status === "planned" ? (
            <>
              <Clock3 size={12} />
              Coming soon
            </>
          ) : (
            <>
              <ShieldCheck size={12} />
              On-device processing
            </>
          )}
        </span>
      </div>
      {tool.status === "planned" ? (
        <div className="panel result-panel mt-8">
          <span className="tool-icon blue">
            <Clock3 size={23} />
          </span>
          <h2>A little more is on the way.</h2>
          <p>
            {tool.name} is scheduled for a later implementation phase. It is not available in this
            release.
          </p>
          <Button asChild variant="secondary">
            <Link href="/tools?category=Ready%20to%20use">Explore available tools</Link>
          </Button>
        </div>
      ) : (
        <ToolClient tool={tool} />
      )}
    </>
  );
}
