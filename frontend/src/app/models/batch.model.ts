export interface Batch {
  range: string;
  timestamp: string;
  checked: number;
  found: number;
  elapsed: number;
  rps: number;
  status: "completed" | "in-progress";
}
