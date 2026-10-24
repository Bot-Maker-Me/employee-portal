export type TopicCategory =
  | "general"
  | "order_query"
  | "delivery"
  | "clinical"
  | "other";
export type TopicPriority = "normal" | "urgent";

export const CATEGORY_ORDER: TopicCategory[] = [
  "general",
  "order_query",
  "delivery",
  "clinical",
  "other",
];

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  general: "General",
  order_query: "Order query",
  delivery: "Delivery",
  clinical: "Clinical question",
  other: "Other",
};
