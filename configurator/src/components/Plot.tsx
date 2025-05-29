'use client'
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import SuperJSON from 'superjson'
import { trpc } from '@/lib/trpc/client'
import { getUrl } from '@/lib/trpc/utils'
import type { AppRouter } from '@/lib/server/routers/_app'

// Plotly loader
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const MAX_POINTS = 1000
const PADDING_RATIO_X = 0.12
const PADDING_RATIO_Y = 0.1

// shape of series data per phase
interface SeriesData {
  x: number[]
  y: number[]
}

type SeriesMap = Record<string, SeriesData>
type VisibilityMap = Record<string, boolean>

export default function PlotComponent() {
  const [seriesMap, setSeriesMap] = useState<SeriesMap>({})
  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>({})

  const trpcClient = createTRPCProxyClient<AppRouter>({
    transformer: SuperJSON,
    links: [httpBatchLink({ url: getUrl() })],
  })

  const recentQuery = trpc.rmsValues.getRecentRmsValues.useQuery(MAX_POINTS, {
    refetchInterval: 1000,
    onSuccess: ({ rmsValues }) => {
      const newMap: SeriesMap = {}
      rmsValues.forEach(r => {
        const phase = r.phase
        const t = new Date(r.time).getTime() / 1000
        if (!newMap[phase]) newMap[phase] = { x: [], y: [] }
        newMap[phase].x.push(t)
        newMap[phase].y.push(r.rms_value)
      })
      Object.values(newMap).forEach(series => {
        series.x = series.x.slice(-MAX_POINTS)
        series.y = series.y.slice(-MAX_POINTS)
      })
      setSeriesMap(newMap)
      setVisibilityMap(prev => {
        const updated: VisibilityMap = { ...prev }
        Object.keys(newMap).forEach(phase => {
          if (!(phase in updated)) updated[phase] = true
        })
        return updated
      })
    },
  })

  if (recentQuery.isLoading) return <div>Loading...</div>
  if (recentQuery.error) return <div>Error: {recentQuery.error.message}</div>

  const togglePhase = (phase: string) => {
    setVisibilityMap(prev => ({ ...prev, [phase]: !prev[phase] }))
  }

  return (
    <div className="flex flex-col gap-8 items-center w-full overflow-y-scroll">
      {/* Visibility controls */}
      <div className="flex gap-4 mb-4">
        {Object.keys(seriesMap).map(phase => (
          <label key={phase} className="flex items-center">
            <input
              type="checkbox"
              checked={visibilityMap[phase] ?? true}
              onChange={() => togglePhase(phase)}
              className="mr-2"
            />
            <span>Phase {phase}</span>
          </label>
        ))}
      </div>

      {/* Plots */}
      {Object.entries(seriesMap)
        .filter(([phase]) => visibilityMap[phase] ?? true)
        .map(([phase, serie]) => {
          const xMin = Math.min(...serie.x)
          const xMax = Math.max(...serie.x)
          const xPad = (xMax - xMin) * PADDING_RATIO_X
          const yMin = Math.min(...serie.y)
          const yMax = Math.max(...serie.y)
          const yPad = (yMax - yMin) * PADDING_RATIO_Y

          return (
            <div key={phase} className="flex flex-col items-center w-full space-y-2">
              <button onClick={() => togglePhase(phase)} className="font-bold border border-white px-2 py-1">
                Phase {phase}{' '}
                <span className={`inline-block transform duration-300 ${!visibilityMap[phase] ? ' -rotate-90' : ''}`}>
                  ↓
                </span>
              </button>
              {visibilityMap[phase] && (
                <Plot
                  data={[
                    {
                      type: 'scattergl',
                      x: serie.x,
                      y: serie.y,
                      mode: 'lines',
                      name: `Phase ${phase}`,
                    },
                  ]}
                  layout={{
                    xaxis: { title: { text: 'Time [s]' }, zeroline: false, autorange: false, range: [xMin - xPad, xMax + xPad] },
                    yaxis: { title: { text: 'Voltage [V]' }, zeroline: false, autorange: false, range: [yMin - yPad, yMax + yPad] },
                    title: { text: `RMS - Phase ${phase}`, x: 0.5 },
                    margin: { t: 50, b: 40, l: 60, r: 20 },
                    width: 900,
                    height: 300,
                  }}
                  config={{ displayModeBar: false }}
                />
              )}
            </div>
          )
        })}
    </div>
  )
}
