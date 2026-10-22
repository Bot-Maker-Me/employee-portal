import { Skeleton } from "@/components/skeleton";

export default function PortalLoading() {
  return (
    <div className="space-y-6 p-5 md:p-8">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[68px] w-full" />
        ))}
      </div>
    </div>
  );
}
