import { getApiClient } from "../client";

export function getPersonalityTest(): Promise<unknown> {
  return getApiClient().get("/api/personality-test");
}

export function submitPersonalityTest(
  answers: Record<string, string>
): Promise<{ badge: string }> {
  return getApiClient().post("/api/personality-test", { answers });
}
