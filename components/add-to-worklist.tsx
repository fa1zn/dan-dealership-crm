"use client";

import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "./ui";
import { addToWorklistAction } from "@/app/sequences/actions";

/**
 * "Add to worklist" — the one action on a Discovery row. On success the server revalidates
 * /sequences, the dealer flips to 'working', and the row drops out of the new-only list, so
 * the disappearance is the confirmation.
 */
export function AddToWorklist({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => start(() => addToWorklistAction(id))}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Add to worklist
    </Button>
  );
}
