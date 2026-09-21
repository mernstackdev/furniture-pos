"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";

/**
 * Every Server Action in this app returns the same shape, so one helper can
 * turn all of them into react-query mutations.
 */
export interface ActionResult {
  error: string | null;
  message?: string | null;
}

/**
 * A Server Action as a react-query mutation.
 *
 * Replaces `useActionState` + `useActionToast`. The action still runs on the
 * server and still re-checks permissions and validates — this only changes who
 * owns the pending flag, the result, and the cache refresh:
 *
 *   - `mutation.isPending` replaces the `useActionState` pending flag, and is
 *     measured across the whole round trip rather than per render.
 *   - `mutation.data?.error` replaces the action state for field errors.
 *   - `mutate` can be passed straight to `<form action={...}>`; React hands it
 *     the FormData.
 *   - Success invalidates the listed keys. Without this, `revalidatePath`
 *     refreshes the server render while the browser cache keeps serving the
 *     stale list — the failure mode is silent, which is why it is enforced here
 *     rather than left to each call site.
 *
 * Trade-off worth knowing: `<form action={serverAction}>` submits without
 * JavaScript; a mutation does not. The rest of this app already needs JS
 * (modals, comboboxes, collapsible filters), so this is not a new constraint.
 */
export function useServerAction<Result extends ActionResult>(options: {
  action: (formData: FormData) => Promise<Result>;
  /** Query keys to refresh when the action reports success. */
  invalidate?: QueryKey[];
  /** Runs after the toast, only on success. */
  onSuccess?: (result: Result) => void;
}) {
  const { action, invalidate, onSuccess } = options;
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      // An action reports a validation or permission failure by returning
      // `error`, not by throwing, so success has to be checked explicitly.
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.message) toast.success(result.message);

      for (const queryKey of invalidate ?? []) {
        queryClient.invalidateQueries({ queryKey });
      }

      onSuccess?.(result);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    },
  });
}

/**
 * Adapts an action written for `useActionState` — `(previousState, formData)` —
 * into the single-argument form `useServerAction` and `<form action>` expect.
 */
export function withoutPrevious<Result extends ActionResult>(
  action: (previous: Result, formData: FormData) => Promise<Result>,
  initialState: Result
) {
  return (formData: FormData) => action(initialState, formData);
}
