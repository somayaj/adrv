import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { archNodeTypes } from "./ArchNodes";
import { specToFlow, type ArchNodeData } from "./layout";
import type { ArchitectureSpec } from "@adrv/core/browser";

type Props = {
  spec: ArchitectureSpec;
};

export function ArchitectureCanvas({ spec }: Props) {
  const laidOut = useMemo(() => specToFlow(spec), [spec]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ArchNodeData>>(
    [] as Node<ArchNodeData>[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);

  useEffect(() => {
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
  }, [laidOut, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={archNodeTypes}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.35}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
      className="bg-[#0a0a0c]"
    >
      <Background gap={20} color="#27272a" />
      <Controls
        showInteractive={false}
        className="!border-border !bg-panel !shadow-none"
      />
      <MiniMap
        nodeColor={(n) => {
          const k = (n.data as ArchNodeData)?.kind;
          if (k === "database") return "#10b981";
          if (k === "queue") return "#8b5cf6";
          if (k === "gateway") return "#f59e0b";
          return "#3b82f6";
        }}
        className="!border-border !bg-panel"
      />
    </ReactFlow>
  );
}
