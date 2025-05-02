'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Button } from './ui/button'
import { trpc } from '@/lib/trpc/client'
import { NewGooseSettingParams } from '@/lib/db/schema/gooseSettings'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { NewSampledValuesSettingParams } from '@/lib/db/schema/sampledValuesSettings'

export default function AddConfigFileButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [fileGooseSettings, setFileGooseSettings] = useState<NewGooseSettingParams | null>(null)
  const [fileSampledSettings,setFileSampledSettings]=useState<NewSampledValuesSettingParams | null>(null)
  const { data } = trpc.gooseSettings.getGooseSettings.useQuery()
  const gooseSettings = data?.gooseSettings
  const { data: sampledData } = trpc.sampledValuesSettings.getSampledValuesSettings.useQuery()
  const sampledValuesSettings = sampledData?.sampledValuesSettings
  const utils = trpc.useContext()
  const router = useRouter()

  const { mutate: createGooseSetting } =
    trpc.gooseSettings.createGooseSetting.useMutation({
      onSuccess: () => {
        utils.gooseSettings.getGooseSettings.invalidate()
        router.refresh()
        toast.success('Goose Setting created!')
      },
      onError: (err) => toast.error(err.message),
    })

  const { mutate: updateGooseSetting } =
    trpc.gooseSettings.updateGooseSetting.useMutation({
      onSuccess: () => {
        utils.gooseSettings.getGooseSettings.invalidate()
        router.refresh()
        toast.success('Goose Setting updated!')
      },
      onError: (err) => toast.error(err.message),
    })

  const { mutate: createSampledValuesSetting, isLoading: isCreating } =
    trpc.sampledValuesSettings.createSampledValuesSetting.useMutation({
      onSuccess: (res) => onSuccess("create"),
      onError: (err) => onError("create", { error: err.message }),
    });

  const { mutate: updateSampledValuesSetting, isLoading: isUpdating } =
    trpc.sampledValuesSettings.updateSampledValuesSetting.useMutation({
      onSuccess: (res) => onSuccess("update"),
      onError: (err) => onError("update", { error: err.message }),
    });

  const onSuccess = async (
    action: "create" | "update" | "delete",
    data?: { error?: string }
  ) => {
    if (data?.error) {
      toast.error(data.error);
      return;
    }

    await utils.sampledValuesSettings.getSampledValuesSettings.invalidate();
    router.refresh();
    toast.success(`Sampled Values Setting ${action}d!`);
  };

  const onError = async (
    action: "create" | "update" | "delete",
    data?: { error?: string }
  ) => { };

  // 3️⃣ parsare fișier JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/json') {
      return alert('Only JSON files allowed')
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string)
        setFileGooseSettings(json.gooseSettings)
        setFileSampledSettings(json.sampledValuesSettings)
        setFileName(file.name)
        console.log("json este: ",json)
      } catch {
        alert("File doesn't have a valid JSON")
      }
    }
    reader.readAsText(file)
  }

  useEffect(() => {
    if (!fileGooseSettings || !fileSampledSettings ) return
    console.log("aici")
    if(sampledValuesSettings?.id){
      updateSampledValuesSetting({...fileSampledSettings, id: sampledValuesSettings.id})
    }
    else {
      createSampledValuesSetting(fileSampledSettings);
    }

    if (gooseSettings?.id) {
      updateGooseSetting({ ...fileGooseSettings, id: gooseSettings.id })
    } else {
      createGooseSetting(fileGooseSettings)
    }
  }, [fileGooseSettings])

  return (
    <div className="flex flex-col items-start w-full gap-2">
      <input
        type="file"
        accept="application/json"
        className="hidden"
        ref={inputRef}
        onChange={handleFileChange}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        className=" bg-gray-500 text-white hover:text-black"
      >
        {fileName || 'Add Config File'}
      </Button>
    </div>
  )
}
