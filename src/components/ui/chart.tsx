"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "@/lib/utils"

// Base configuration for colors and labels
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
  }
}

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

function ChartContainer({ id, className, config, children, ...props }: any) {
  const chartId = React.useId()
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn("flex aspect-video justify-center text-xs", className)}
        {...props}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          [data-chart="${chartId}"] {
            ${Object.entries(config).map(([key, item]: any) => `
              --color-${key}: ${item.color};
            `).join("")}
          }
        `}} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({ active, payload, label, hideLabel = false }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm animate-in fade-in-0 zoom-in-95">
      {!hideLabel && <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((item: any) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.fill }} />
            <span className="font-medium">{item.name}:</span>
            <span className="font-bold">₹{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }