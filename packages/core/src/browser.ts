/** Browser-safe entry: types + architecture parsing only (no Node fs/glob). */
export type {
  AdrEdge,
  AdrEdgeType,
  AdrGraph,
  AdrRecord,
  AdrStatus,
} from "./types.js";
export type { ArchitectureSpec, ArchNodeKind } from "./architecture.js";
export {
  architectureSource,
  hasArchitecture,
  parseArchitectureFromBody,
} from "./architecture.js";
export {
  decisionStepsForRecord,
  decisionStepsFromBody,
} from "./decisionSteps.js";
