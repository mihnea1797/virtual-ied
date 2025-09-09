'use client'
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc/client'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const MAX_POINTS = 1000

interface SeriesData {
  x: Date[]
  y: number[]
}

type SeriesMap = Record<string, Record<string, SeriesData>>
type VisibilityMap = Record<string, Record<string, boolean>>
function normalizeMeasurement(m: unknown): string {
  if (typeof m === 'string') return m.trim().toUpperCase()
  return String(m ?? '').toUpperCase()
}
function normalizePhase(p: unknown): string {
  const s = String(p ?? '').trim()
  return s || '1'
}

export default function PlotComponent() {
  const [seriesMap, setSeriesMap] = useState<SeriesMap>({})
  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>({})

  const recentQuery = trpc.rmsValues.getRecentRmsValues.useQuery(MAX_POINTS, {
    refetchInterval: 1000,
    onSuccess: (data) => {
      const rmsValues: Array<{
        phase: string | number
        measurement: string
        time: string | number | Date
        rms_value: number
      }> = 'rmsValues' in data ? (data as any).rmsValues : (data as any)

      const newMap: SeriesMap = {}

      for (const r of rmsValues) {
        const m = normalizeMeasurement((r as any).measurement)
        const p = normalizePhase(r.phase)
        const t = new Date(r.time)

        if (!newMap[m]) newMap[m] = {}
        if (!newMap[m][p]) newMap[m][p] = { x: [], y: [] }

        newMap[m][p].x.push(t)
        newMap[m][p].y.push((r as any).rms_value)
      }

      Object.values(newMap).forEach((perPhase) => {
        Object.values(perPhase).forEach((series) => {
          series.x = series.x.slice(-MAX_POINTS)
          series.y = series.y.slice(-MAX_POINTS)
        })
      })

      setSeriesMap(newMap)

      setVisibilityMap((prev) => {
        const copy: VisibilityMap = { ...prev }
        for (const m of Object.keys(newMap)) {
          copy[m] ||= {}
          for (const p of Object.keys(newMap[m])) {
            if (!(p in copy[m])) copy[m][p] = true
          }
        }
        return copy
      })
    },
  })

  if (recentQuery.isLoading) return <div>Loading...</div>
  if (recentQuery.error) return <div>Error: {recentQuery.error.message}</div>

  const togglePhase = (measurement: string, phase: string) => {
    setVisibilityMap((prev) => ({
      ...prev,
      [measurement]: {
        ...(prev[measurement] || {}),
        [phase]: !(prev[measurement]?.[phase] ?? true),
      },
    }))
  }

  const toggleMeasurementAll = (measurement: string, value?: boolean) => {
    setVisibilityMap((prev) => {
      const current = prev[measurement] || {}
      const nextVal =
        value ?? !Object.values(current).every((v) => v ?? true)
      const updated: Record<string, boolean> = {}
      const phases = Object.keys(seriesMap[measurement] || {})
      for (const p of phases) updated[p] = nextVal
      return { ...prev, [measurement]: updated }
    })
  }

  const measurements = Object.keys(seriesMap).sort()

  return (
    <div className="flex flex-col gap-8 items-center w-full overflow-y-auto">
      <div className="flex w-full max-w-5xl space-x-4">
        {measurements.map((m) => {
          const phases = Object.keys(seriesMap[m] || {}).sort() 
          const allVisible = phases.length
            ? phases.every((p) => visibilityMap[m]?.[p] ?? true)
            : true

          return (
            <div key={m} className="border border-white/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-semibold">Measurement: {m}</div>
                <button
                  onClick={() => toggleMeasurementAll(m)}
                  className="text-sm border border-white/40 px-2 py-1 rounded-md"
                >
                  {allVisible ? 'Hide all phases' : 'Show all phases'}
                </button>
              </div>
              <div className="flex gap-2 flex-wrap w-full">
                {phases.map((p) => (
                  <label key={`${m}-${p}`} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibilityMap[m]?.[p] ?? true}
                      onChange={() => togglePhase(m, p)}
                      className="mr-2"
                    />
                    <span>{m} – Phase {p}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="w-full max-w-6xl space-y-10">
        {measurements.map((m) => {
          const perPhase = seriesMap[m]
          const phases = Object.keys(perPhase || {}).sort()

          const traces = phases
            .filter((p) => visibilityMap[m]?.[p] ?? true)
            .map((p) => ({
              type: 'scattergl' as const,
              x: perPhase[p].x,
              y: perPhase[p].y,
              mode: 'lines' as const,
              name: `Phase ${p}`,
            }))

          if (traces.length === 0) return null

          const yTitle = m === 'V' ? 'Voltage [V]' : m === 'C' ? 'Current [A]' : m

          return (
            <div key={`plot-${m}`} className="w-full">
              <Plot
                data={traces}
                layout={{
                  title: { text: `RMS – ${m}`, x: 0.5 },
                  xaxis: {
                    title: { text: 'Time' },
                    type: 'date',
                    autorange: true,
                  },
                  yaxis: {
                    title: { text: yTitle },
                    autorange: true,
                  },
                  margin: { t: 50, b: 40, l: 60, r: 20 },
                  height: 360,
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
