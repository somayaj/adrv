import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { ArchNodeData } from "./layout";

const KIND_LABEL: Record<string, string> = {
  client: "Client",
  gateway: "Gateway",
  service: "Service",
  database: "Database",
  queue: "Event bus",
  worker: "Worker",
  external: "External",
};

function BaseShell({
  data,
  selected,
  accent,
  children,
}: {
  data: ArchNodeData;
  selected?: boolean;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative px-3 py-2 text-center transition-shadow ${
        selected ? "ring-2 ring-blue-500/50" : ""
      }`}
      style={{
        borderColor: accent,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-zinc-600 !bg-zinc-800"
      />
      <p
        className="text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: accent }}
      >
        {KIND_LABEL[data.kind] ?? data.kind}
      </p>
      <p
        className="mt-0.5 max-w-[220px] text-sm font-semibold leading-snug text-zinc-50"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
      >
        {data.label}
      </p>
      {data.description && (
        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
          {data.description}
        </p>
      )}
      {children}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-zinc-600 !bg-zinc-800"
      />
    </div>
  );
}

export function ClientNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div
      className={`min-w-[120px] rounded-full border border-zinc-600 bg-zinc-900/90 ${selected ? "ring-2 ring-blue-500/40" : ""}`}
    >
      <BaseShell data={data} selected={selected} accent="#a1a1aa" />
    </div>
  );
}

export function ServiceNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div
      className={`min-w-[140px] rounded-lg border border-blue-500/40 bg-gradient-to-b from-zinc-800/90 to-zinc-900 ${selected ? "ring-2 ring-blue-500/40" : ""}`}
    >
      <BaseShell data={data} selected={selected} accent="#60a5fa" />
    </div>
  );
}

export function GatewayNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div
      className={`min-w-[140px] rounded-md border-2 border-amber-500/50 bg-zinc-900 ${selected ? "ring-2 ring-amber-500/30" : ""}`}
    >
      <BaseShell data={data} selected={selected} accent="#fbbf24" />
    </div>
  );
}

export function DatabaseNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div className={`flex flex-col items-center ${selected ? "ring-2 ring-blue-500/40 rounded-lg" : ""}`}>
      <div
        className="h-2 w-[88px] rounded-t-full border border-emerald-500/50 border-b-0 bg-emerald-950/80"
      />
      <div
        className="min-w-[100px] rounded-b-lg border border-emerald-500/50 bg-emerald-950/60 px-3 py-2"
      >
        <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
          Database
        </p>
        <p
          className="max-w-[220px] text-sm font-semibold leading-snug text-zinc-50"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
          {data.label}
        </p>
      </div>
      <Handle type="target" position={Position.Top} className="!top-0 !bg-zinc-700" />
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-700" />
    </div>
  );
}

export function QueueNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div
      className={`min-w-[140px] rounded-lg border border-violet-500/45 bg-violet-950/40 ${selected ? "ring-2 ring-violet-500/40" : ""}`}
    >
      <BaseShell data={data} selected={selected} accent="#c4b5fd" />
    </div>
  );
}

export function WorkerNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div
      className={`min-w-[130px] rounded-lg border border-dashed border-zinc-500 bg-zinc-900/80 ${selected ? "ring-2 ring-blue-500/40" : ""}`}
    >
      <BaseShell data={data} selected={selected} accent="#71717a" />
    </div>
  );
}

export function ExternalNode({ data, selected }: NodeProps<Node<ArchNodeData>>) {
  return (
    <div
      className={`min-w-[120px] rounded-lg border border-zinc-600 bg-zinc-950 ${selected ? "ring-2 ring-blue-500/40" : ""}`}
    >
      <BaseShell data={data} selected={selected} accent="#52525b" />
    </div>
  );
}

export const archNodeTypes = {
  client: ClientNode,
  gateway: GatewayNode,
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  worker: WorkerNode,
  external: ExternalNode,
};
