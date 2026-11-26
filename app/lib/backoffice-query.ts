import { QueryClient, type QueryKey } from "@tanstack/react-query";

export const queryStaleTime = {
  static: 5 * 60_000,
  operational: 60_000,
  dashboard: 15_000,
  notifications: 30_000,
} as const;

export const backofficeKeys = {
  all: ["backoffice"] as const,
  command: (params: {
    period: string;
    person: string;
    product: string;
    stage: string;
    paymentStatus: string;
    objectiveSituation: string;
  }) => ["backoffice", "command", params] as const,
  objectives: ["backoffice", "objectives"] as const,
  objectiveHistory: (id: string) => ["backoffice", "objectives", "history", id] as const,
  commercial: ["backoffice", "commercial"] as const,
  commercialDetail: (id: string) => ["backoffice", "commercial", "detail", id] as const,
  notifications: ["backoffice", "notifications"] as const,
  profile: ["backoffice", "profile"] as const,
  blocks: (subjectType: string, subjectId: string) => ["backoffice", "blocks", subjectType, subjectId] as const,
  team: ["backoffice", "team"] as const,
  attendees: (params: { startDate: string; endDate: string; courseSlug: string }) =>
    ["backoffice", "attendees", params] as const,
};

export type BackofficeScope =
  | "command"
  | "objectives"
  | "commercial"
  | "notifications"
  | "profile"
  | "blocks"
  | "team"
  | "attendees";

const scopeKey: Record<BackofficeScope, QueryKey> = {
  command: ["backoffice", "command"],
  objectives: ["backoffice", "objectives"],
  commercial: ["backoffice", "commercial"],
  notifications: ["backoffice", "notifications"],
  profile: ["backoffice", "profile"],
  blocks: ["backoffice", "blocks"],
  team: ["backoffice", "team"],
  attendees: ["backoffice", "attendees"],
};

export class BackofficeRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BackofficeRequestError";
    this.status = status;
  }
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof BackofficeRequestError && (error.status === 401 || error.status === 403 || error.status === 400)) {
    return false;
  }
  return failureCount < 1;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: queryStaleTime.operational,
        gcTime: 10 * 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function clearBackofficeCache() {
  if (typeof window === "undefined") return;
  getQueryClient().clear();
}

export function invalidateBackoffice(...scopes: BackofficeScope[]) {
  if (typeof window === "undefined") return Promise.resolve();
  const client = getQueryClient();
  return Promise.all(scopes.map((scope) => client.invalidateQueries({ queryKey: scopeKey[scope] })));
}
