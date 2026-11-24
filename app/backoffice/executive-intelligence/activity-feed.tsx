"use client";

type Activity = {
  id: string;
  timestamp: string;
  type: "crm" | "objective" | "finance";
  actor_email: string;
  department: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  status?: "ok" | "pending" | "failed";
};

type ActivityFeedProps = {
  activities: Activity[];
  loading: boolean;
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    return `${minutes}m atrás`;
  }
  if (hours < 24) {
    return `${hours}h atrás`;
  }
  return date.toLocaleDateString("pt-AO", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeIcon(type: "crm" | "objective" | "finance"): string {
  switch (type) {
    case "crm":
      return "🎯";
    case "objective":
      return "📊";
    case "finance":
      return "💰";
  }
}

function getStatusColor(status?: string): string {
  switch (status) {
    case "ok":
      return "bg-[#e8f0e6] border-[#8fc97f]";
    case "pending":
      return "bg-[#f0f0e6] border-[#d4d49f]";
    case "failed":
      return "bg-[#f0e8e6] border-[#d9a8a8]";
    default:
      return "bg-[#faf9f8] border-[#e7e1df]";
  }
}

export default function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[#e7e1df]" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-[#e7e1df] bg-[#faf9f8] p-8 text-center">
        <div className="text-3xl">📭</div>
        <p className="mt-2 text-sm text-[#716a69]">Nenhuma atividade neste período</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className={`rounded-lg border-l-4 border ${getStatusColor(activity.status)} p-4 transition hover:shadow-md`}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">{getTypeIcon(activity.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#510f1d]">{formatTime(activity.timestamp)}</span>
                    <span className="text-xs bg-[#510f1d] text-white px-2 py-1 rounded-full">
                      {activity.department}
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold text-[#510f1d]">{activity.title}</h3>
                  <p className="mt-1 text-sm text-[#716a69]">{activity.description}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#862f3b]">
                <span>👤 {activity.actor_email}</span>
                {activity.details.reason ? (
                  <span className="italic">Motivo: {String(activity.details.reason)}</span>
                ) : null}
              </div>

              {activity.details.amount_kz ? (
                <div className="mt-2 text-sm font-semibold text-[#510f1d]">
                  💵 AOA {Number(activity.details.amount_kz).toLocaleString("pt-AO")} Kz
                </div>
              ) : null}

              {activity.details.progress_percentage ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 overflow-hidden rounded-full bg-[#e7e1df] h-2">
                    <div
                      className="h-full bg-[#8fc97f] transition-all"
                      style={{
                        width: `${Math.min(Number(activity.details.progress_percentage), 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#510f1d]">
                    {Number(activity.details.progress_percentage)}%
                  </span>
                </div>
              ) : null}

              {activity.details.note ? (
                <p className="mt-2 text-xs italic text-[#716a69]">
                  💬 &quot;{String(activity.details.note)}&quot;
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
