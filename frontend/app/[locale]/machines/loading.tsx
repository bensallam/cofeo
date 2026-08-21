import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";

export default function MachinesLoading() {
  return (
    <Section>
      <Container>
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
