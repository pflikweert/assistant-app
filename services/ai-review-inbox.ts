import { fetchAdminBootstrap, fetchAdminJson } from "@/services/admin-api";
import type {
  AiReviewItemStatus,
  AiReviewRow,
} from "@/services/ai-use-cases";

export type AiReviewInboxItem = AiReviewRow & {
  status: AiReviewItemStatus | string;
};

type BootstrapReviewPayload = {
  reviewItems: AiReviewInboxItem[];
};

export async function loadAiReviewInboxItems() {
  try {
    const bootstrap = await fetchAdminBootstrap<BootstrapReviewPayload>();
    return bootstrap.reviewItems;
  } catch (error) {
    console.warn("[ai-review-inbox] bootstrap load failed", error);
    return [] as AiReviewInboxItem[];
  }
}

export async function updateAiReviewItemStatus(
  id: string,
  status: AiReviewItemStatus,
) {
  return fetchAdminJson<{ reviewItem: AiReviewInboxItem }>("/api/admin", {
    method: "PATCH",
    body: JSON.stringify({
      resource: "review-items",
      id,
      status,
    }),
  });
}
