'use client'

import React, { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc/client'
import { TRPCClientError } from '@trpc/client'

const Plot: React.ComponentType<any> = dynamic(
  () => import('react-plotly.js').then((mod) => mod.default),
  { ssr: false }
)

export default function PlotComponent() {
  const ingest = trpc.rmsValues.ingestRms.useMutation()

  const {
    data: rmsData,
    isLoading: loadingData,
    error: dataError,
    refetch,
  } = trpc.rmsValues.getAllRmsValues.useQuery(undefined, { enabled: false })

  useEffect(() => {
    ingest.mutate(undefined, {
      onSuccess: () => refetch(),
      onError: (err) => console.error('Ingest error', err),
    })
  }, [])

  useEffect(() => {
    console.log("Ingested data:", rmsData)
  }, [rmsData])

  if (ingest.isLoading || loadingData) {
    return <div>Loading data...</div>
  }
  if (ingest.isError) {
    const err = ingest.error as TRPCClientError<any>
    return <div>Error ingesting data: {err.message}</div>
  }
  if (dataError) {
    return <div>Error loading data: {dataError.message}</div>
  }

  // Date pentru semnalul fara noise
  const timesRaw = rmsData?.rmsValues.map((r) => new Date(r.time).getTime() / 1000) ?? []
  const valuesRaw = rmsData?.rmsValues.map((r) => r.value) ?? []

  // Date pentru semnalul cu noise
  const timesFiltered = rmsData?.filteredValues.map((r) => new Date(r.time).getTime() / 1000) ?? []
  const valuesFiltered = rmsData?.filteredValues.map((r) => r.value) ?? []

  const commonAxes = {
    xaxis: {
      title: 'Time [s]',
      zeroline: false,
    },
    yaxis: {
      title: 'Voltage [V]',
      zeroline: false,
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
      <Plot
        data={[{ x: timesRaw, y: valuesRaw, mode: 'lines', name: 'Unfiltered' }]}
        layout={{
          ...commonAxes,
          title: { text: 'RMS - without noise', x: 0.5 },
          margin: { t: 50, b: 40, l: 60, r: 20 },
          width: 900,
          height: 300,
        }}
        config={{ displayModeBar: false }}
      />
      <Plot
       data={[{
        x: timesFiltered,
        y: valuesFiltered,
        mode: 'lines',
        name: 'Filtered',
        line: {
          shape: 'hv'
        }
      }]}
        layout={{
          ...commonAxes,
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
