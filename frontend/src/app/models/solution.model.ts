export interface Solution {
  id?: string;
  batchId?: string;
  timestamp?: Date;
  cubesCount?: number;
  parameterCombination?: {
    a: number;
    b: number;
    c: number;
    d: number;
  };
  a: number;
  b: number;
  c: number;
  d: number;
  batchRange: string;
  logFile?: string;
  lineNumber?: number;
  rawLine?: string;
}
