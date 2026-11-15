export type WorkflowVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";

export interface WorkflowState {
  name: string;
  label?: string;
  color?: string;
  variant?: WorkflowVariant;
}

export interface WorkflowTransition<TRecord = Record<string, unknown>> {
  from: string | string[];
  to: string;
  label?: string;
  variant?: WorkflowVariant;
  role?: string | string[];
  canExecute?: (ctx: { record: TRecord; user?: Record<string, unknown> }) => boolean;
}

export interface WorkflowConfig<TRecord = Record<string, unknown>> {
  field: string;
  initial?: string;
  states?: Array<string | WorkflowState>;
  locked?: string[];
  transitions?: Record<string, WorkflowTransition<TRecord>>;
}
