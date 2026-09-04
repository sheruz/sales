import { PipelineBoard } from "@/components/crm/pipeline-board";

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pipeline</h2>
        <p className="text-muted-foreground">
          Move opportunities from qualified through meeting, proposal,
          negotiation, won — and into revenue — without leaving the platform.
        </p>
      </div>
      <PipelineBoard />
    </div>
  );
}
