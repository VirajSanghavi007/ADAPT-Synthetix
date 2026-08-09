export async function friendlyApiError(res: Response): Promise<string> {
  let detail = "";
  try {
    const data = await res.json();
    detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
  } catch {
    detail = await res.text().catch(() => "");
  }

  if (res.status === 429) {
    return `${detail || "Rate limit exceeded"} — upgrade your plan on the Subscription page for a higher limit.`;
  }
  if (res.status === 403 && detail.toLowerCase().includes("tier")) {
    return `${detail} Upgrade your plan on the Subscription page to use this model.`;
  }
  if (res.status === 401) {
    return "Session expired — please sign in again.";
  }
  return detail || `Request failed (${res.status})`;
}
