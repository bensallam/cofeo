import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <Section tone="dark">
      <Container>
        <Skeleton className="mb-8 h-8 w-32" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-4 border-b border-border pb-6">
                <Skeleton className="size-24 shrink-0" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-auto h-8 w-32" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </Container>
    </Section>
  );
}
