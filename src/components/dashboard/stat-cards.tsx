"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useRealtime } from "@/components/dashboard/realtime";

export function StatCards() {
  const { stats, incidents } = useRealtime();
  const cards: { label: string; value: number; accent: string }[] = [
    { label: "Total tickets", value: stats?.total ?? incidents.length, accent: "text-black" },
    { label: "Critical", value: stats?.critical ?? 0, accent: "text-red-600" },
    { label: "Active", value: stats?.active ?? 0, accent: "text-orange-600" },
    { label: "Resolved", value: stats?.resolved ?? 0, accent: "text-emerald-600" },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4 sm:p-6 sm:pt-6">
            <p className="text-xs text-black/55 sm:text-sm">{card.label}</p>
            <p className={`mt-1 text-3xl font-semibold tracking-tight sm:mt-2 sm:text-4xl ${card.accent}`}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
