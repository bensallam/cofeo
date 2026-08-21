import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <Section>
      <Container>
        <Skeleton className="mb-6 h-4 w-64" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
