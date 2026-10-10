import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { AdrNodeData } from "./buildFlow";
import { statusBadgeClass } from "./status";

export function AdrNode({ data, selected }: NodeProps<Node<AdrNodeData>>) {
  const { record } = data;
  return (
    <div
      className={`min-w-[200px] max-w-[240px] rounded-lg border bg-panel px-3 py-2 shadow-none transition-colors ${
        selected
          ? "border-blue-500 ring-2 ring-blue-500/40"
          : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-500" />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {record.id}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusBadgeClass(record.status)}`}
        >
          {record.status}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium leading-snug text-zinc-100">
        {record.title}
      </p>
      {record.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {record.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-zinc-500"
      />
    </div>
  );
}
