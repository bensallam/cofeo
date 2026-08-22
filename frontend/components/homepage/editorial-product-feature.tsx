import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";

type Condition = "new" | "excellent" | "very-good" | "good";

type EditorialProductFeatureProps = {
  href: string;
  index: number;
  imageSrc?: string;
  imageAlt: string;
  brand: string;
  name: string;
  condition?: Condition;
  price: number | null;
  originalPrice?: number;
  available?: boolean;
};

/**
 * The homepage's "MACHINES" tile — deliberately not ProductCard: no
 * border/shadow/card frame at all, because the brief calls for products
 * that don't "appear as ordinary ecommerce cards." The image is the
 * entire visual weight (large, tall, numbered like a catalogue plate);
 * PRODUCT / BRAND / PRICE / DISCOVER sits below as plain hierarchy, not
 * boxed content. The Catalogue grid keeps the bordered ProductCard —
 * that's a dense browse-many-at-once list, a different job from this
 * page's four curated pieces.
 */
export function EditorialProductFeature({
  href,
  index,
  imageSrc,
  imageAlt,
  brand,
  name,
  condition,
  price,
  originalPrice,
  available = true,
}: EditorialProductFeatureProps) {
  const t = useTranslations("Product");
  const catalogueT = useTranslations("Catalogue");

  return (
    <Link href={href} className="group flex flex-col gap-6">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
        <span className="absolute top-4 start-4 z-10 text-caption tracking-[0.2em] text-text-muted tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <ProductImage
          src={imageSrc}
          alt={imageAlt}
          mode="card"
          sizes="(min-width: 1024px) 45vw, 90vw"
          className="transition-transform duration-500 ease-(--ease-precise) group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-caption tracking-[0.2em] text-text-muted uppercase">
            <bdi>{brand}</bdi>
          </p>
          <h3 className="text-heading-s font-medium text-text-primary">
            <bdi>{name}</bdi>
          </h3>
          {condition && <p className="text-body-s text-text-secondary">{t(`condition.${condition}`)}</p>}
          {available ? (
            <Price amount={price} originalAmount={originalPrice} />
          ) : (
            <span className="text-body-s text-text-muted">{t("outOfStock")}</span>
          )}
        </div>

        <span className="mt-1 flex shrink-0 items-center gap-1.5 text-caption font-medium tracking-[0.15em] text-text-primary uppercase transition-colors duration-200 group-hover:text-bronze">
          {catalogueT("discoverLabel")}
          <ArrowIcon className="size-3 transition-transform duration-200 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-6-6m6 6-6 6" />
    </svg>
  );
}
