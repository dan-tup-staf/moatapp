import { tokenStorage } from "@/lib/auth";

// Render's `fromService` injects a bare hostname (no scheme); prepend https
// so the blueprint can wire the API URL automatically without manual editing.
// Also strip any trailing slash(es): a value like "https://api.example.com/"
// would otherwise produce "https://api.example.com//api/v1/..." and 404.
const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");
const API_URL = /^https?:\/\//.test(RAW_API_URL)
  ? RAW_API_URL
  : `https://${RAW_API_URL}`;

// ---------- Types ----------

export type UserRead = {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
};

export type Token = {
  access_token: string;
  token_type: string;
};

export type EmailStatus = {
  configured: boolean;
  host: string;
  port: number;
  from_email: string;
  from_name: string;
  starttls: boolean;
  use_tls: boolean;
  daily_limit: number;
};

export type TestEmailResult = {
  ok: boolean;
  sent_to: string;
  detail: string | null;
};

export type Domain = {
  id: number;
  domain: string;
  created_at: string;
};

export type DomainCheck = { ok: boolean; detail: string };

export type DomainHealth = {
  domain: string;
  checks: Record<string, DomainCheck>;
  score: number;
  max_score: number;
  healthy: boolean;
};

export type LeadList = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  leads_count: number;
};

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "bounced"
  | "unsubscribed";

export type Lead = {
  id: number;
  list_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  website: string | null;
  status: LeadStatus;
  score: number;
  notes: string | null;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LeadCreate = {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  website?: string;
  status?: LeadStatus;
  notes?: string;
};

export type LeadUpdate = Partial<LeadCreate> & { score?: number };

export type CsvImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

// ---------- Campaigns ----------

export type CampaignStatus = "draft" | "active" | "paused" | "archived";

export type CampaignGroup = {
  id: number;
  name: string;
  created_at: string;
  sequences_count: number;
};

export type Campaign = {
  id: number;
  name: string;
  status: CampaignStatus;
  from_email: string;
  from_name: string | null;
  group_id: number | null;
  scheduled_at: string | null;
  send_window_start_hour: number;
  send_window_end_hour: number;
  send_days: string;
  include_unsubscribe: boolean;
  unsubscribe_text: string | null;
  track_opens: boolean;
  stop_on_reply: boolean;
  track_clicks: boolean;
  text_only: boolean;
  same_thread: boolean;
  cc: string | null;
  bcc: string | null;
  sending_priority: string;
  deal_value: number | null;
  created_at: string;
  updated_at: string;
  steps_count: number;
  enrollments_count: number;
};

export type CampaignCreate = {
  name: string;
  from_email: string;
  from_name?: string;
  scheduled_at?: string | null;
  group_id?: number | null;
};

export type CampaignUpdate = Partial<CampaignCreate> & {
  status?: CampaignStatus;
  group_id?: number | null;
  send_window_start_hour?: number;
  send_window_end_hour?: number;
  send_days?: string;
  include_unsubscribe?: boolean;
  unsubscribe_text?: string | null;
  track_opens?: boolean;
  stop_on_reply?: boolean;
  track_clicks?: boolean;
  text_only?: boolean;
  same_thread?: boolean;
  cc?: string | null;
  bcc?: string | null;
  sending_priority?: string;
  deal_value?: number | null;
};

export type StepChannel =
  | "email"
  | "linkedin_visit"
  | "linkedin_invite"
  | "linkedin_message"
  | "call"
  | "whatsapp"
  | "task";

export type SequenceStep = {
  id: number;
  campaign_id: number;
  step_order: number;
  subject: string;
  body_template: string;
  delay_days: number;
  channel: StepChannel;
};

export type StepCreate = {
  step_order: number;
  subject: string;
  body_template: string;
  delay_days: number;
  channel?: StepChannel;
};

export type StepUpdate = Partial<StepCreate>;

export type StepVariant = {
  id: number;
  step_id: number;
  subject: string;
  body_template: string;
  created_at: string;
};

export type EnrollmentStatus =
  | "active"
  | "completed"
  | "paused"
  | "replied"
  | "bounced";

export type EnrollmentOutcome =
  | "interested"
  | "meeting_booked"
  | "closed_won"
  | "not_interested"
  | "out_of_office";

export type Enrollment = {
  id: number;
  campaign_id: number;
  lead_id: number;
  current_step: number;
  next_send_at: string | null;
  status: EnrollmentStatus;
  outcome: EnrollmentOutcome | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  lead_email: string | null;
  lead_name: string | null;
  lead_company: string | null;
  lead_title: string | null;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  last_activity_at: string | null;
};

export type EnrollmentUpdate = {
  outcome?: EnrollmentOutcome;
  clear_outcome?: boolean;
  tags?: string[];
  status?: EnrollmentStatus;
};

export type BulkAction =
  | "pause"
  | "resume"
  | "remove"
  | "add_tag"
  | "set_outcome"
  | "clear_outcome";

export type EnrollmentBulkRequest = {
  enrollment_ids: number[];
  action: BulkAction;
  tag?: string;
  outcome?: EnrollmentOutcome;
};

export type EnrollResult = {
  enrolled: number;
  skipped_already_enrolled: number;
};

export type PreviewResponse = {
  subject: string;
  body: string;
};

export type StepStats = {
  step_id: number;
  step_order: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
};

export type EnrollmentsBreakdown = {
  total: number;
  active: number;
  completed: number;
  paused: number;
  replied: number;
  bounced: number;
};

export type CampaignPipelineStage = {
  stage: string;
  name: string;
  companies_count: number;
  total_score: number;
  tier1: number;
  tier2: number;
  tier3: number;
};

export type ProspectFunnel = {
  total: number;
  not_contacted: number;
  contacted: number;
  opened: number;
  clicked: number;
  replied: number;
  interested: number;
  meeting_booked: number;
  closed: number;
  not_interested: number;
  out_of_office: number;
};

export type CampaignStats = {
  enrollments: EnrollmentsBreakdown;
  messages_sent_total: number;
  messages_failed_total: number;
  steps: StepStats[];
  pipeline: CampaignPipelineStage[];
  funnel: ProspectFunnel;
};

export type AudienceCriteria = {
  include_list_ids?: number[];
  exclude_list_ids?: number[];
  tiers?: number[];
  min_source_strength?: number | null;
  signal_source_ids?: number[];
  signal_title_query?: string | null;
};

export type AudienceLead = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  score: number;
  tier: 1 | 2 | 3;
  list_id: number;
  list_name: string;
  signals_count: number;
  already_enrolled: boolean;
};

export type AudiencePreview = {
  leads: AudienceLead[];
  matched_total: number;
  already_enrolled_count: number;
};

// ---------- Signals ----------

export type SourceType =
  | "rss"
  | "pracuj_pl"
  | "linkedin"
  | "google_news"
  | "x_twitter"
  | "serp"
  | "funding"
  | "company_site";

export type SignalSource = {
  id: number;
  name: string;
  type: SourceType;
  config: Record<string, unknown>;
  enabled: boolean;
  score_weight: number;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
  signals_count: number;
};

export type SignalSourceCreate = {
  name: string;
  type: SourceType;
  config: Record<string, unknown>;
  enabled?: boolean;
  score_weight?: number;
};

export type SignalSourceUpdate = Partial<
  Omit<SignalSourceCreate, "type">
> & { enabled?: boolean };

export type Signal = {
  id: number;
  source_id: number;
  source_name: string | null;
  lead_id: number | null;
  lead_email: string | null;
  company_domain: string | null;
  title: string;
  url: string | null;
  payload: Record<string, unknown>;
  score_weight: number;
  detected_at: string;
};

export type RunResult = {
  new_signals: number;
  error: string | null;
};

export type SignalSourcePreset = {
  key: string;
  category: string;
  category_label: string;
  name: string;
  type: SourceType;
  score_weight: number;
  description: string;
  config: Record<string, unknown>;
};

export type CompanyRow = {
  company: string;
  leads_count: number;
  total_score: number;
  highest_status: string;
  signals_count: number;
  active_enrollments: number;
  last_message_sent_at: string | null;
};

export type PersonRow = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  status: string;
  score: number;
  list_id: number;
  list_name: string;
  signals_count: number;
  last_message_sent_at: string | null;
  created_at: string;
};

export type SignalSummary = {
  source_id: number;
  source_name: string;
  source_type: SourceType;
  enabled: boolean;
  signals_count: number;
  unique_companies: number;
  linked_signals_count: number;
  linked_leads_count: number;
  pipeline_impact: number;
  latest_signal_at: string | null;
  last_run_at: string | null;
};

// ---------- Dashboard ----------

export type DashboardStats = {
  leads_total: number;
  leads_contacted: number;
  campaigns_total: number;
  campaigns_active: number;
  messages_sent_total: number;
  messages_sent_last_7d: number;
  signals_total: number;
  signals_last_7d: number;
  active_enrollments: number;
};

export type HotLead = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  status: string;
  score: number;
  list_id: number;
  list_name: string;
  signals_count: number;
};

export type PipelineStage =
  | "awareness"
  | "education"
  | "requirements"
  | "vendor_selection";

export type PipelineCompany = {
  company: string;
  leads_count: number;
  total_score: number;
  tier: 1 | 2 | 3;
  signals_count: number;
  last_activity_at: string | null;
};

export type PipelineStageBucket = {
  stage: PipelineStage;
  name: string;
  companies: PipelineCompany[];
  companies_count: number;
  total_score: number;
};

export type PipelineView = {
  stages: PipelineStageBucket[];
};

// ---------- ICP ----------

export type CompanyProfile = {
  employees: string;
  industry: string;
  recruitments_per_year: string;
  hr_employees: string;
};

export type Persona = {
  title: string;
  pain_points: string[];
  gain_points: string[];
  personal_goals: string[];
  professional_goals: string[];
};

export type IcpFields = {
  target_industries: string[];
  company_size: string;
  buyer_persona_titles: string[];
  pain_points: string[];
  triggers: string[];
  notes: string;
  company: CompanyProfile;
  personas: Persona[];
};

export type IcpQA = { question: string; answer: string };

export type IcpProfile = {
  id: number;
  source_url: string | null;
  scraped_summary: string | null;
  qa_history: IcpQA[];
  icp_fields: IcpFields;
  created_at: string;
  updated_at: string;
};

export type AnalyzeUrlResponse = {
  scraped_summary: string;
  suggested_questions: string[];
};

export type SuggestedSource = {
  type: SourceType;
  name: string;
  query: string;
  rationale: string;
  score_weight: number;
  max_results: number;
};

export type SuggestSourcesResponse = {
  sources: SuggestedSource[];
};

export type IcpFieldsUpdate = Partial<{
  target_industries: string[];
  company_size: string;
  buyer_persona_titles: string[];
  pain_points: string[];
  triggers: string[];
  notes: string;
}>;

// ---------- Errors ----------

export class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail);
  }
}

// ---------- Low-level helpers ----------

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

function authed<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, tokenStorage.get());
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = tokenStorage.get();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------- Public API ----------

export const api = {
  // Auth
  register: (data: { email: string; password: string; name?: string }) =>
    request<UserRead>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<Token>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => authed<UserRead>("/auth/me"),

  // Email (sending mailbox)
  email: {
    status: () => authed<EmailStatus>("/email/status"),
    test: (to?: string) =>
      authed<TestEmailResult>("/email/test", {
        method: "POST",
        body: JSON.stringify({ to: to ?? null }),
      }),
  },

  // Domains (deliverability health)
  domains: {
    list: () => authed<Domain[]>("/domains"),
    create: (domain: string) =>
      authed<Domain>("/domains", {
        method: "POST",
        body: JSON.stringify({ domain }),
      }),
    delete: (id: number) =>
      authed<void>(`/domains/${id}`, { method: "DELETE" }),
    health: (id: number) => authed<DomainHealth>(`/domains/${id}/health`),
    check: (domain: string) =>
      authed<DomainHealth>(
        `/domains/check?domain=${encodeURIComponent(domain)}`,
      ),
  },

  // Campaign groups (umbrella "Kampanie" over sequences)
  groups: {
    list: () => authed<CampaignGroup[]>("/campaign-groups"),
    create: (name: string) =>
      authed<CampaignGroup>("/campaign-groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    update: (id: number, name: string) =>
      authed<CampaignGroup>(`/campaign-groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    delete: (id: number) =>
      authed<void>(`/campaign-groups/${id}`, { method: "DELETE" }),
  },

  // Lists
  lists: {
    list: () => authed<LeadList[]>("/lists"),

    create: (data: { name: string; description?: string }) =>
      authed<LeadList>("/lists", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (id: number) => authed<LeadList>(`/lists/${id}`),

    update: (id: number, data: { name?: string; description?: string }) =>
      authed<LeadList>(`/lists/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      authed<void>(`/lists/${id}`, { method: "DELETE" }),
  },

  // Leads (nested under lists)
  leads: {
    list: (listId: number) => authed<Lead[]>(`/lists/${listId}/leads`),

    create: (listId: number, data: LeadCreate) =>
      authed<Lead>(`/lists/${listId}/leads`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (listId: number, leadId: number, data: LeadUpdate) =>
      authed<Lead>(`/lists/${listId}/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (listId: number, leadId: number) =>
      authed<void>(`/lists/${listId}/leads/${leadId}`, {
        method: "DELETE",
      }),

    importCsv: (listId: number, file: File) =>
      uploadFile<CsvImportResult>(`/lists/${listId}/leads/import`, file),
  },

  // Campaigns
  campaigns: {
    list: () => authed<Campaign[]>("/campaigns"),

    create: (data: CampaignCreate) =>
      authed<Campaign>("/campaigns", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (id: number) => authed<Campaign>(`/campaigns/${id}`),

    update: (id: number, data: CampaignUpdate) =>
      authed<Campaign>(`/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      authed<void>(`/campaigns/${id}`, { method: "DELETE" }),

    // Steps
    listSteps: (campaignId: number) =>
      authed<SequenceStep[]>(`/campaigns/${campaignId}/steps`),

    createStep: (campaignId: number, data: StepCreate) =>
      authed<SequenceStep>(`/campaigns/${campaignId}/steps`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateStep: (campaignId: number, stepId: number, data: StepUpdate) =>
      authed<SequenceStep>(`/campaigns/${campaignId}/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteStep: (campaignId: number, stepId: number) =>
      authed<void>(`/campaigns/${campaignId}/steps/${stepId}`, {
        method: "DELETE",
      }),

    testSendStep: (campaignId: number, stepId: number, to?: string) =>
      authed<{ ok: boolean; sent_to: string; subject: string }>(
        `/campaigns/${campaignId}/steps/${stepId}/test-send`,
        { method: "POST", body: JSON.stringify({ to: to ?? null }) },
      ),

    // A/B variants (step's own subject/body is variant "A")
    listVariants: (campaignId: number, stepId: number) =>
      authed<StepVariant[]>(
        `/campaigns/${campaignId}/steps/${stepId}/variants`,
      ),
    createVariant: (
      campaignId: number,
      stepId: number,
      data: { subject: string; body_template: string },
    ) =>
      authed<StepVariant>(`/campaigns/${campaignId}/steps/${stepId}/variants`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    generateAiVariant: (campaignId: number, stepId: number) =>
      authed<StepVariant>(
        `/campaigns/${campaignId}/steps/${stepId}/variants/ai`,
        { method: "POST" },
      ),
    deleteVariant: (campaignId: number, stepId: number, variantId: number) =>
      authed<void>(
        `/campaigns/${campaignId}/steps/${stepId}/variants/${variantId}`,
        { method: "DELETE" },
      ),

    // Enrollments
    listEnrollments: (campaignId: number) =>
      authed<Enrollment[]>(`/campaigns/${campaignId}/enrollments`),

    enrollFromList: (campaignId: number, listId: number) =>
      authed<EnrollResult>(`/campaigns/${campaignId}/enrollments`, {
        method: "POST",
        body: JSON.stringify({ list_id: listId }),
      }),

    unenroll: (campaignId: number, enrollmentId: number) =>
      authed<void>(`/campaigns/${campaignId}/enrollments/${enrollmentId}`, {
        method: "DELETE",
      }),

    updateEnrollment: (
      campaignId: number,
      enrollmentId: number,
      patch: EnrollmentUpdate,
    ) =>
      authed<Enrollment>(
        `/campaigns/${campaignId}/enrollments/${enrollmentId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      ),

    bulkEnrollments: (campaignId: number, req: EnrollmentBulkRequest) =>
      authed<{ affected: number }>(
        `/campaigns/${campaignId}/enrollments/bulk`,
        { method: "POST", body: JSON.stringify(req) },
      ),

    preview: (campaignId: number, stepId: number, leadId: number) =>
      authed<PreviewResponse>(`/campaigns/${campaignId}/preview`, {
        method: "POST",
        body: JSON.stringify({ step_id: stepId, lead_id: leadId }),
      }),

    sendDueNow: (campaignId: number) =>
      authed<{ processed: number }>(
        `/campaigns/${campaignId}/send-due-now`,
        { method: "POST" },
      ),

    stats: (campaignId: number) =>
      authed<CampaignStats>(`/campaigns/${campaignId}/stats`),

    audiencePreview: (campaignId: number, criteria: AudienceCriteria) =>
      authed<AudiencePreview>(`/campaigns/${campaignId}/audience/preview`, {
        method: "POST",
        body: JSON.stringify(criteria),
      }),

    audienceEnroll: (campaignId: number, leadIds: number[]) =>
      authed<EnrollResult>(`/campaigns/${campaignId}/audience/enroll`, {
        method: "POST",
        body: JSON.stringify({ lead_ids: leadIds }),
      }),
  },

  // Signal sources
  signalSources: {
    list: () => authed<SignalSource[]>("/signal-sources"),

    create: (data: SignalSourceCreate) =>
      authed<SignalSource>("/signal-sources", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    createBatch: (sources: SignalSourceCreate[]) =>
      authed<SignalSource[]>("/signal-sources/batch", {
        method: "POST",
        body: JSON.stringify({ sources }),
      }),

    presets: () => authed<SignalSourcePreset[]>("/signal-sources/presets"),

    get: (id: number) => authed<SignalSource>(`/signal-sources/${id}`),

    update: (id: number, data: SignalSourceUpdate) =>
      authed<SignalSource>(`/signal-sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      authed<void>(`/signal-sources/${id}`, { method: "DELETE" }),

    runNow: (id: number) =>
      authed<RunResult>(`/signal-sources/${id}/run-now`, { method: "POST" }),
  },

  // Signals feed
  signals: {
    list: (opts: { limit?: number; sourceId?: number } = {}) => {
      const params = new URLSearchParams();
      params.set("limit", String(opts.limit ?? 100));
      if (opts.sourceId !== undefined) {
        params.set("source_id", String(opts.sourceId));
      }
      return authed<Signal[]>(`/signals?${params.toString()}`);
    },

    summary: () => authed<SignalSummary[]>("/signals/summary"),

    delete: (id: number) =>
      authed<void>(`/signals/${id}`, { method: "DELETE" }),
  },

  // Dashboard
  dashboard: {
    stats: () => authed<DashboardStats>("/dashboard/stats"),
    hotLeads: (limit = 10) =>
      authed<HotLead[]>(`/dashboard/hot-leads?limit=${limit}`),
    pipeline: () => authed<PipelineView>("/dashboard/pipeline"),
  },

  // CRM aggregates (cross-list views for Listy tabs)
  companies: {
    list: () => authed<CompanyRow[]>("/companies"),
  },
  people: {
    list: () => authed<PersonRow[]>("/people"),
  },

  icp: {
    get: () => authed<IcpProfile | null>("/icp"),
    analyzeUrl: (payload: { url?: string; manual_description?: string }) =>
      authed<AnalyzeUrlResponse>("/icp/analyze-url", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    synthesize: (qa: IcpQA[]) =>
      authed<IcpProfile>("/icp/synthesize", {
        method: "POST",
        body: JSON.stringify({ qa }),
      }),
    suggestSources: () =>
      authed<SuggestSourcesResponse>("/icp/suggest-sources", {
        method: "POST",
      }),
    updateFields: (fields: IcpFieldsUpdate) =>
      authed<IcpProfile>("/icp", {
        method: "PATCH",
        body: JSON.stringify(fields),
      }),
    delete: () => authed<void>("/icp", { method: "DELETE" }),
  },
};
