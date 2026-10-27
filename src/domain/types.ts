import { z } from 'zod';
export const categories = {
  ACCESS: 'Acesso',
  NETWORK: 'Rede e VPN',
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
  EMAIL: 'E-mail',
  OTHER: 'Outros',
} as const;
export const priorities = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
} as const;
export const ticketStatuses = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING: 'Aguardando analista',
  APPROVED: 'Aprovado',
  RESOLVED: 'Resolvido',
} as const;
export const states = {
  AGENT: 'Com o agent',
  WAITING_ANALYST: 'Aguardando analista',
  HUMAN: 'Em atendimento',
  CLOSED: 'Encerrada',
} as const;
export const ticketInput = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(10).max(6000),
  type: z.enum(['INC', 'REQ']),
  category: z.enum(['ACCESS', 'NETWORK', 'HARDWARE', 'SOFTWARE', 'EMAIL', 'OTHER']),
  impact: z.enum(['PERSON', 'TEAM', 'COMPANY']),
  urgency: z.enum(['BLOCKED', 'TODAY', 'WORKAROUND', 'NO_RUSH']),
});
export type TicketInput = z.infer<typeof ticketInput>;
export const decisionSchema = z.object({
  intent: z.enum(['QUESTION', 'STATUS', 'CREATE', 'UPDATE', 'HANDOFF', 'OUT_OF_SCOPE', 'CLARIFY']),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(500),
  ticketId: z.string().nullable(),
  title: z.string().max(160).nullable(),
  description: z.string().max(4000).nullable(),
  type: z.enum(['INC', 'REQ']).nullable(),
  category: z.enum(['ACCESS', 'NETWORK', 'HARDWARE', 'SOFTWARE', 'EMAIL', 'OTHER']).nullable(),
  impact: z.enum(['PERSON', 'TEAM', 'COMPANY']).nullable(),
  urgency: z.enum(['BLOCKED', 'TODAY', 'WORKAROUND', 'NO_RUSH']).nullable(),
  articleIds: z.array(z.string()).max(3),
  question: z.string().nullable(),
  options: z.array(z.string()).max(4),
});
export type Decision = z.infer<typeof decisionSchema>;
export type TraceAction = { label: string; result: string; durationMs: number; success: boolean };
export type DecisionTrace = {
  intent: string;
  confidence: number;
  reason: string;
  rules: string[];
  actions: TraceAction[];
  sources: { id: string; title: string }[];
  durationMs: number;
  model: string;
  tokens: number;
};
export type MessageMetadata = {
  trace?: DecisionTrace;
  ticketIds?: string[];
  draftId?: string;
  options?: string[];
  articleIds?: string[];
  handoff?: boolean;
};
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  os: string;
  role: 'EMPLOYEE' | 'ANALYST';
  team: string | null;
  passwordChangedAt: string | null;
};
export type UITicket = {
  id: string;
  number: string;
  title: string;
  description: string;
  type: keyof { INC: 0; REQ: 0 };
  category: keyof typeof categories;
  priority: keyof typeof priorities;
  status: keyof typeof ticketStatuses;
  impact: string;
  urgency: string;
  team: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  resolvedAt: string | null;
};
export type UIMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'ANALYST' | 'SYSTEM';
  content: string;
  metadata: MessageMetadata;
  createdAt: string;
};
export type UIDraft = {
  id: string;
  operation: string;
  version: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  data: TicketInput & { priority?: keyof typeof priorities; dueAt?: string };
  ticketId: string | null;
};
export type UIConversation = {
  id: string;
  title: string;
  state: keyof typeof states;
  messageCount: number;
  version: number;
  owner: PublicUser;
  assignedTo: PublicUser | null;
  handoffReason: string | null;
  handoffSummary: string | null;
  handoffTeam: string | null;
  updatedAt: string;
  messages: UIMessage[];
  drafts: UIDraft[];
  tickets: UITicket[];
};
