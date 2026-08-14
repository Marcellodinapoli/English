import type { QueryClient } from "@tanstack/react-query";

/** Invalidate Home Daily Plan + Progress after learning writes. */
export async function invalidateLearningQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] }),
    queryClient.invalidateQueries({ queryKey: ["progress"] }),
  ]);
}
