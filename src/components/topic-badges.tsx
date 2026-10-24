import {
  CATEGORY_LABELS,
  type TopicCategory,
  type TopicPriority,
} from "@/lib/topics";

export function CategoryTag({ category }: { category: TopicCategory }) {
  return (
    <span className="label-mono rounded-btn border border-line px-2 py-0.5 text-muted">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: TopicPriority }) {
  if (priority !== "urgent") return null;
  return (
    <span className="label-mono rounded-btn border border-accent bg-accent-tint px-2 py-0.5 text-accent-soft">
      Urgent
    </span>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="label-mono min-w-[18px] rounded-full bg-accent px-1.5 py-0.5 text-center text-white">
      {count}
    </span>
  );
}
