"use client";

import { Button } from "../ui/button";
import { signOutAction } from "@/lib/actions/users";
import { useTransition } from "react";

export default function SignOutBtn() {
  const [isPending, startTransition] = useTransition();
  
  const handleSignOut = () => {
    startTransition(() => {
      signOutAction();
    });
  };

  return (
    <Button 
      onClick={handleSignOut} 
      disabled={isPending} 
      variant={"destructive"}
      className="w-full text-left"
    >
      Sign{isPending ? "ing" : ""} out
    </Button>
  );
}