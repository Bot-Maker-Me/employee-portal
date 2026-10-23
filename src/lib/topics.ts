export type TopicCategory =
  | "general"
  | "order_query"
  | "delivery"
  | "clinical"
  | "other";
export type TopicPriority = "normal" | "urgent";
export type TopicStatus = "open" | "closed";
export type SenderSide = "employee" | "pharmacy";

export type TopicThread = {
  id: string;
  organization: string;
  title: string;
  category: TopicCategory;
  priority: TopicPriority;
  status: TopicStatus;
  created_by: string;
  employee_last_read_at: string | null;
  pharmacy_last_read_at: string | null;
  last_message_at: string;
  created_at: string;
};

export type TopicMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_side: SenderSide;
  body: string;
  created_at: string;
};

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
