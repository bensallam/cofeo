import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrderConfirmationLoading() {
  return (
    <Section>
      <Container>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-4 h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Container>
    </Section>
  );
}
