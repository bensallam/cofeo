import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`
 * (see node_modules/next/dist/docs/.../proxy.md). next-intl's
 * `createMiddleware` still returns a standard NextRequest handler,
 * so it's just re-exported under the new name here.
 */
export default function proxy(request: Parameters<typeof handleI18nRouting>[0]) {
  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
