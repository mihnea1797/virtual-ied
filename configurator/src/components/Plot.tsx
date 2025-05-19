'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import SuperJSON from 'superjson'

import { getUrl } from '@/lib/trpc/utils'
import type { AppRouter } from '@/lib/server/routers/_app'
import { trpc } from '@/lib/trpc/client'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const MAX_POINTS = 1000
const PADDING_RATIO_X = 0.12;
const PADDING_RATIO_Y = 0.1; 

export default function PlotComponent() {
  const [since, setSince] = useState<string | null>(null)
  const [rmsRaw, setRmsRaw] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [rmsFiltered, setRmsFiltered] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })

  const trpcClient = createTRPCProxyClient<AppRouter>({
    transformer: SuperJSON,
    links: [httpBatchLink({ url: getUrl() })],
  })

  const initialQuery = trpc.rmsValues.getAllRmsValues.useQuery(undefined, {
    onSuccess: (data) => {
      const raw = data.rmsValues.map(r => ({
        x: new Date(r.time).getTime() / 1000,
        y: r.value,
      }))
      const filtered = data.filteredValues.map(r => ({
        x: new Date(r.time).getTime() / 1000,
        y: r.value,
      }))

      setRmsRaw({
        x: raw.map(r => r.x).slice(-MAX_POINTS),
        y: raw.map(r => r.y).slice(-MAX_POINTS),
      })
      setRmsFiltered({
        x: filtered.map(r => r.x).slice(-MAX_POINTS),
        y: filtered.map(r => r.y).slice(-MAX_POINTS),
      })

      const latestTime = [
        ...data.rmsValues,
        ...data.filteredValues,
      ]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0]?.time

      if (latestTime) {
        setSince(new Date(latestTime).toISOString())
      }
    },
  })

  useEffect(() => {
    if (!since) return

    const interval = setInterval(async () => {
      try {
        const res = await trpcClient.rmsValues.getRmsValuesSince.query({ since })
        if (!res.rmsValues.length) return

        const newRaw = res.rmsValues.filter(r => !r.filtered)
        const newFiltered = res.rmsValues.filter(r => r.filtered)

        setRmsRaw(prev => {
          const xs = [...prev.x, ...newRaw.map(r => new Date(r.time).getTime() / 1000)]
          const ys = [...prev.y, ...newRaw.map(r => r.value)]
          return {
            x: xs.slice(-MAX_POINTS),
            y: ys.slice(-MAX_POINTS),
          }
        })

        setRmsFiltered(prev => {
          const xs = [...prev.x, ...newFiltered.map(r => new Date(r.time).getTime() / 1000)]
          const ys = [...prev.y, ...newFiltered.map(r => r.value)]
          return {
            x: xs.slice(-MAX_POINTS),
            y: ys.slice(-MAX_POINTS),
          }
        })

        const latest = res.rmsValues.at(-1)?.time
        if (latest) {
          setSince(new Date(latest).toISOString())
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [since, trpcClient])

  if (initialQuery.isLoading) return <div>Loading...</div>
  if (initialQuery.error) return <div>Error: {initialQuery.error.message}</div>

  const xMinRaw = Math.min(...rmsRaw.x)
  const xMaxRaw = Math.max(...rmsRaw.x)
  const xPadRaw = (xMaxRaw - xMinRaw) * PADDING_RATIO_X

  const yMinRaw = Math.min(...rmsRaw.y)
  const yMaxRaw = Math.max(...rmsRaw.y)
  const yPadRaw = (yMaxRaw - yMinRaw) * PADDING_RATIO_Y

  const xMinF = Math.min(...rmsFiltered.x)
  const xMaxF = Math.max(...rmsFiltered.x)
  const xPadF = (xMaxF - xMinF) * PADDING_RATIO_X

  const yMinF = Math.min(...rmsFiltered.y)
  const yMaxF = Math.max(...rmsFiltered.y)
  const yPadF = (yMaxF - yMinF) * PADDING_RATIO_Y

  return (
    <div className="flex flex-col gap-8 items-center w-full">
      <Plot
        data={[{
          type: 'scattergl',
          x: rmsRaw.x,
          y: rmsRaw.y,
          mode: 'lines',
          name: 'Unfiltered',
        }]}
        layout={{
          xaxis: {
            title: { text: 'Time [s]' },
            zeroline: false,
            autorange: false,
            range: [xMinRaw - xPadRaw, xMaxRaw + xPadRaw],
          },
          yaxis: {
            title: { text: 'Voltage [V]' },
            zeroline: false,
            autorange: false,
            range: [yMinRaw - yPadRaw, yMaxRaw + yPadRaw],
          },
          title: { text: 'RMS - without noise', x: 0.5 },
          margin: { t: 50, b: 40, l: 60, r: 20 },
          width: 900,
          height: 300,
        }}
        config={{ displayModeBar: false }}
      />

      <Plot
        data={[{
          type: 'scattergl',
          x: rmsFiltered.x,
          y: rmsFiltered.y,
          mode: 'lines',
          name: 'Filtered',
          line: { shape: 'hv' },
        }]}
        layout={{
          xaxis: {
            title: { text: 'Time [s]' },
            zeroline: false,
            autorange: false,
            range: [xMinF - xPadF, xMaxF + xPadF],
          },
          yaxis: {
            title: { text: 'Voltage [V]' },
            zeroline: false,
            autorange: false,
            range: [yMinF - yPadF, yMaxF + yPadF],
          },
          title: { text: 'RMS - With Noise', x: 0.5 },
          margin: { t: 50, b: 40, l: 60, r: 20 },
          width: 900,
          height: 300,
        }}
        config={{ displayModeBar: false }}
      />
    </div>
  )
}
