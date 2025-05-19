'use client'

import React, { useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'

export default function MergingUnitStatus() {
  const { data, isLoading, error, refetch } = trpc.gooseSettings.getMergingUnitStatus.useQuery()

  useEffect(() => {
    const iv = setInterval(() => refetch(), 5000)
    return () => clearInterval(iv)
  }, [refetch])

  if (isLoading) return <p>Checking Status</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <h3>Status: {data.isRunning ? 'Running ✅' : 'Stopped ❌'}</h3>
    </div>
  )
}
