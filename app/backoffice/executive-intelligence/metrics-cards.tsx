"use client";

type Metrics = {
  crmConverted: number;
  crmConvertedPercent: number;
  objectivesAchieved: number;
  objectivesTotal: number;
  revenueAmount: number;
  expensesAmount: number;
  byArea: Array<{
    area_id: string;
    area_name: string;
    crm_activities: number;
    crm_converted: number;
    objectives_total: number;
    objectives_achieved: number;
    revenue: number;
  }>;
};

type MetricsCardsProps = {
  metrics: Metrics | null;
  loading: boolean;
};

export default function MetricsCards({ metrics, loading }: MetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[#e7e1df]" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const cards = [
    {
      icon: "🎯",
      label: "Oportunidades Convertidas",
      value: metrics.crmConverted,
      subtext: `${metrics.crmConvertedPercent}%`,
      bgColor: "bg-[#f0e8e6]",
    },
    {
      icon: "📊",
      label: "Objetivos Alcançados",
      value: `${metrics.objectivesAchieved}/${metrics.objectivesTotal}`,
      subtext: metrics.objectivesTotal > 0 
        ? `${Math.round((metrics.objectivesAchieved / metrics.objectivesTotal) * 100)}%`
        : "0%",
      bgColor: "bg-[#e8f0e6]",
    },
    {
      icon: "💰",
      label: "Receita do Período",
      value: `AOA ${(metrics.revenueAmount / 1_000_000).toFixed(1)}M`,
      subtext: `${metrics.revenueAmount.toLocaleString("pt-AO")} Kz`,
      bgColor: "bg-[#e6f0e8]",
    },
    {
      icon: "📉",
      label: "Despesas do Período",
      value: `AOA ${(metrics.expensesAmount / 1_000_000).toFixed(1)}M`,
      subtext: `${metrics.expensesAmount.toLocaleString("pt-AO")} Kz`,
      bgColor: "bg-[#f0e6e8]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`${card.bgColor} rounded-xl border border-[#e7e1df] p-4 transition hover:shadow-md`}
        >
          <div className="text-2xl">{card.icon}</div>
          <div className="mt-2 text-xs font-medium text-[#716a69]">{card.label}</div>
          <div className="mt-2 text-lg font-bold text-[#510f1d]">{card.value}</div>
          <div className="mt-1 text-xs text-[#862f3b]">{card.subtext}</div>
        </div>
      ))}
    </div>
  );
}
