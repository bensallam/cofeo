/**
 * Server-renders a schema.org `<script type="application/ld+json">` —
 * present in the initial HTML from the first response, never injected
 * client-side. Mirrors the inline pattern the homepage's own
 * Organization schema already uses (see app/[locale]/page.tsx); pulled
 * out into one component now that the product page needs two of these
 * instead of one, rather than duplicating the same three lines twice.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
