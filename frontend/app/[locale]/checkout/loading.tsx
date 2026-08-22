import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <Section tone="dark">
      <Container>
        <Skeleton className="mb-8 h-8 w-40" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </Container>
    </Section>
  );
}
