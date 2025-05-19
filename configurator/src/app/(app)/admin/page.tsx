import { getUserAuth } from '@/lib/auth/utils';
import React from 'react'

const page = async () => {
    const { session } = await getUserAuth();
    return (
        <div className='flex flex-col p-2'>
            <h1 className="text-2xl font-bold my-2">Profile</h1>
            <pre className="bg-secondary p-4 rounded-lg my-2 ">
                {JSON.stringify(session, null, 2)}
            </pre>
        </div>
    )
}

export default page