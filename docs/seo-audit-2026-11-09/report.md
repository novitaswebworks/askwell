# Askwell SEO verification — 9 November 2026

[Certain] The tested production pages have a working technical SEO foundation. [Likely] The larger organic-growth constraint is the narrow public content footprint, not missing metadata. Several concrete schema and content-consistency issues remain.

This is a source and live-response audit, not proof of Google indexing or rankings. No application code was changed. Local source revision: `10cd9aa`; pre-existing untracked directories were left alone. Public site: https://askwell.novitasweb.works.

## Scope and evidence

- Inspected Next.js metadata, root layouts, public routes, authentication routing, robots, sitemap, redirects, image generation, structured data, FAQ, pricing and navigation.
- Made 19 initial public HTTP requests covering public pages, auth/embed/dashboard, redirects, query variants, a nonexistent URL, icon and crawler user agents; additionally fetched both social images and apple icon.
- Parsed actual response HTML, rather than counting metadata declarations in source. Checked browser hydration at desktop 1440×1000 and mobile 390×844.
- Ran two additional mobile browser samples in fresh browser contexts with cache disabled, configured 150 ms network latency, 1.6 Mbps download and 4× CPU slowdown.
- All 16 existing focused tests passed across `lib/site.test.ts`, `lib/seo.test.ts`, `next.config.test.ts`, and `page.test.ts`.
- Reviewed current Google documentation. This matters: FAQ rich results were discontinued in May 2026.

Evidence files in this folder: `responses.json` (HTTP outcomes), `parsed.json` (metadata, links and JSON-LD), `browser.json` (initial browser observations), `mobile-cold.json` (repeat mobile samples), and screenshots. Some parser-derived word counts join adjacent elements; they are not used as content-quality evidence. The parser's `brokenFragments` field on secondary pages checks against the wrong document for root-relative `/#...` links: those links correctly target existing homepage sections and are not defects.

## Verified public-page inventory

[Certain] Every page below returned HTTP 200, one H1, a distinct title and description, and a canonical matching its public URL. No noindex directive was found in these public-page HTML responses or their captured HTTP headers.

| Path | Live title | Canonical |
|---|---|---|
| `/` | Askwell: AI chatbot for your website, trained on your pages | Public origin |
| `/terms` | Terms of service \| Askwell | `/terms` |
| `/privacy` | Privacy policy \| Askwell | `/privacy` |
| `/refunds` | Cancellation and refunds \| Askwell | `/refunds` |
| `/contact` | Contact \| Askwell | `/contact` |

[Certain] Homepage content, headings, internal links, all six FAQ answers and JSON-LD are present in the returned HTML; principal marketing content does not require client-side JavaScript to be fetched. Native details/summary FAQ controls are a good implementation choice. The homepage title is 59 characters and description 159 characters; these are editorial measurements, not Google ranking thresholds.

[Certain] HTML language is English and the viewport is responsive. The homepage's generic H1 is supported by an explicit product-category eyebrow and descriptive H2. It is not an urgent keyword defect. There is no reason to add hreflang without actual alternate-language pages.

## Crawl, canonical and exclusion checks

| Check | Actual result | Assessment |
|---|---|---|
| `/robots.txt` | 200; allows `/`, blocks `/dashboard`, `/api/`, `/embed`; public sitemap URL | Public discovery works; see embed caveat |
| `/sitemap.xml` | 200 XML, five public canonical URLs | Matches current public inventory |
| HTTP homepage | 308 to HTTPS | Pass |
| Production Vercel alias `/contact?utm_source=seo-audit` | 308 to custom domain, preserves path/query | Pass |
| `/contact/` | 308 to `/contact` | Pass |
| Homepage with UTM query | 200, canonical excludes query | Pass |
| Deliberately nonexistent URL | Actual 404 and noindex | Pass; no soft-404 in this sample |
| `/sign-in`, `/sign-up` | 200 and noindex, crawl allowed | Pass |
| `/embed` | 200 and noindex, but crawl disallowed | Exclusion design issue |
| Anonymous `/dashboard` request | 404 and noindex | No public dashboard content in this request |
| Googlebot/Twitterbot user-agent samples | 200, expected homepage title/canonical/social metadata | Pass for these requests only |

The dashboard outcome is request-specific; it is not evidence that legitimate users cannot access the dashboard. Spoofing a crawler user agent is not a verified Googlebot fetch or Search Console URL Inspection.

### Finding 1 — Make the embed exclusion policy internally consistent

[Certain] `apps/web/lib/site.ts:18` disallows `/embed`, while `apps/web/app/embed/layout.tsx:10` emits noindex. A crawler obeying robots.txt cannot read that directive. Google explicitly documents that blocked URLs can still appear as URL-only results if discovered elsewhere. This is a risk, not a finding that the embed is currently indexed. [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Recommendation: if preventing search appearance is the objective, allow crawling of the public embed HTML and retain noindex; verify parameterized embed URLs also emit it. Preserve authentication on private dashboard content and assess API exclusion separately. An X-Robots-Tag alone does not solve this if crawling remains blocked. What could change this recommendation: deliberate prioritization of crawl suppression over discoverable noindex, with acceptance of possible URL-only listings.

## Structured data and search appearance

[Certain] The live JSON-LD parses and contains Organization, WebSite, SoftwareApplication and FAQPage. Stable IDs link entities, product limits and price use shared constants, and FAQ markup matches the actual answers. Syntax validity is not rich-result eligibility.

### Finding 2 — Organization logo is too small

[Certain] `apps/web/lib/seo.ts:15` sets Organization.logo to `/icon`. The actual downloaded PNG is 48×48, matching `apps/web/app/icon.tsx:5`. Google's organization-logo guidance requires at least 112×112. Keep the favicon at its appropriate size and use a dedicated larger brand asset, preferably 512×512, for Organization.logo. The existing 180×180 apple icon is another candidate if its artwork is appropriate. Acceptance: the schema URL returns a crawlable image at least 112×112. [Google Organization documentation](https://developers.google.com/search/docs/appearance/structured-data/organization).

### Finding 3 — Pro offer metadata omits an important qualification

[Certain] Production displays “₹999”, “per month · opens soon” and “Start free, upgrade soon”. `buildJsonLd()` always includes a Pro Offer at 999 INR with no availability or billing-period qualification. This is incomplete representation of the visible offer; it is not proof of a Google penalty.

Recommendation: condition the offered plans on the same billing-enabled state as the pricing UI, or explicitly describe planned availability and monthly pricing accurately. Retaining only the available free offer until Pro launches is the simplest option. Acceptance: structured data and visible purchasable plans agree in both billing states. What would change this: Pro becomes purchasable and its monthly terms are accurately represented.

### Finding 4 — Rich-result expectations need correction

[Certain] SoftwareApplication has neither `review` nor `aggregateRating`; Google's software-app rich-result requirements include one of those. The markup can still describe the app, but do not report it as eligible for that enhanced appearance. Do not manufacture reviews to satisfy a validator. Add genuine, visible, policy-compliant review evidence only when available. [Google SoftwareApplication requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app).

[Certain] Google stopped displaying FAQ rich results on May 7, 2026 and removed the feature documentation in June. Existing FAQPage markup may remain for semantic use, but investing in it to obtain Google FAQ snippets has no current payoff. Preserve the useful visible FAQ. [Google documentation changelog](https://developers.google.com/search/updates).

[Certain] OG and Twitter images both return 200 PNG at 1200×630; apple icon returns 180×180. Titles, descriptions, image alt text and homepage OG URL are present. Secondary pages receive appropriate titles with the shared brand image. This is sufficient for the current small site; bespoke legal-page social images are low priority. Actual previews in each social network were not tested.

## Content and organic acquisition

### Finding 5 — Only one page answers prospective-customer search intent

[Certain] Public routes consist of a homepage, three policies and contact. Pricing, features and FAQs are homepage sections; installation instructions are largely behind sign-in or in the repository. There are no public integration guides, use-case pages, comparison pages or case studies in this source inventory.

[Likely] This limits opportunities to answer specific searches such as adding a chatbot to WordPress or training a website assistant from documents. This is a strategic inference, not a measured keyword-volume or ranking finding. Start with a few genuinely useful pages rather than creating many thin keyword variants. Google's guidance emphasizes original, useful content. [People-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

Suggested sequence, subject to actual customer demand:

1. Public installation guide with tested steps, screenshots, prerequisites, error handling and links to signup.
2. A guide explaining supported website/document ingestion, limits, update behavior and how to test answer quality.
3. A focused integration guide for the platform customers actually use most; WordPress, Shopify or Next.js are candidates, not validated demand rankings.
4. A real customer case study with permission, measured outcomes and limitations.
5. A standalone pricing page only if it adds meaningful detail about billing, limits and availability beyond the homepage.

Each new page should have an explicit purpose, unique title/description, canonical, useful internal links and sitemap inclusion. What would make this priority wrong: Search Console and customer data show little relevant search demand, or distribution is primarily referral/partner-led and additional content would not support acquisition. No traffic forecast is justified from this audit.

### Finding 6 — Visible claims conflict or overstate certainty

[Certain] The live homepage contains both a working demo section and a “Live demo on the landing page” coming-soon card. Remove the stale card when the demo is configured. `apps/web/lib/plan-features.ts` currently lists it unconditionally.

[Certain] The FAQ answers “Will it make things up?” with “No,” and says it ignores attempts to change its rules. [Likely] These absolute claims create an avoidable credibility problem unless supported by exceptional evidence. Use precise descriptions of grounding, refusal behavior and limitations. This audit did not red-team model behavior or establish an actual hallucination rate. What could change this recommendation: narrowly scoped, reproducible evidence supporting the exact guarantee.

[Certain] Contact email and policy pages are present, and the footer identifies Novitas WebWorks. [Likely] Clearer product ownership, relevant team expertise and genuine case studies would strengthen buyer trust. Avoid invented testimonials, ratings or decorative trust badges.

## Mobile rendering and performance

[Certain] Both tested viewport sizes rendered the homepage with no document-level horizontal overflow and no captured page exceptions during the initial observation. The mobile screenshot shows legible content and primary calls to action. This is not a full accessibility audit or a test of every viewport.

[Certain] The main navigation is hidden below the desktop breakpoint with no mobile replacement (`components/site/site-header.tsx:17`). Footer section links remain, and the hero links to “how it works”, so navigation is not absent altogether. [Likely] A compact mobile menu or section shortcuts would improve access to pricing and FAQ on a long page; this is a usability recommendation, not a confirmed ranking penalty.

| Browser sample | Observed LCP | Sum of observed layout shifts without recent input |
|---|---:|---:|
| Desktop initial, unthrottled | 0.800 s | 0.00042 |
| Mobile cold sample 1, configured throttling | 1.736 s | 0.00074 |
| Mobile cold sample 2, configured throttling | 1.772 s | 0.00074 |

These are short local lab observations using PerformanceObserver, not Lighthouse scores or real-user Core Web Vitals. The layout-shift sum is not a complete session-window CLS implementation. No INP measurement, long session, percentile distribution or CrUX data was obtained. The initial mobile pass reused browser cache and is excluded from this comparison. PageSpeed API returned HTTP 429 quota exhaustion, so no PageSpeed report was produced. Google's targets are LCP within 2.5 seconds, INP under 200 ms and CLS under 0.1; only field measurements can establish how the real audience performs. [Google Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals).

[Certain] Cold mobile resource entries reported about 692 KB transferred, excluding the main document and with cross-origin reporting limitations. Clerk-hosted entries accounted for about 221 KB and font entries about 128 KB. Source loads ClerkProvider on the marketing layout and three font families. [Likely] Deferring unnecessary auth UI and reducing/preloading fonts more selectively are worth testing if field data exposes a problem. Avoid a broad performance rewrite on the strength of these samples: observed loading was already reasonable. Recheck logged-in navigation and signup if changing Clerk loading.

## Measurement gaps and deployment safeguards

- Search Console/Bing account access was not available. Actual indexed URLs, Google-selected canonicals, sitemap submission, impressions, queries, CTR, manual actions and crawl statistics remain unverified.
- A public `site:` search returned no results through the available search tool. This does not establish that Google has indexed zero pages.
- No Google or Bing verification meta tag appeared in sampled homepage HTML. Ownership can be verified through DNS or another method, so absence is not an SEO defect.
- `siteUrl()` accepts the configured public URL without enforcing production HTTPS or excluding localhost/preview hosts. Current production output is correct. Add environment validation as regression protection, not as a fix for a demonstrated current canonical problem.
- Preview deployment robots/headers/protection were not inspected. Check a real preview before claiming it is safely excluded; canonical tags alone are not access protection.
- No backlink, competitor, search-volume or conversion analysis was performed. No separate www alias was established as an intended production hostname.
- Rich Results Test and Google-rendered URL Inspection were not run. Source tests do not substitute for these.
- No complete build, broad test suite or application mutation was necessary for this read-only audit.

## Prioritized action order and acceptance criteria

| Priority | Action | Completion evidence |
|---|---|---|
| First | Confirm Search Console ownership and baseline | URL Inspection, selected canonical, sitemap receipt and performance baseline |
| First | Fix Organization.logo | Actual schema image at least 112×112 and valid response |
| First | Align demo status, Pro availability and claims | Visible copy and JSON-LD agree with actual product state |
| Next | Resolve embed crawl/noindex policy | Crawlable public embed emits noindex; private authentication unchanged |
| Next | Publish one demand-led guide | Original useful content, indexable URL, internal links, sitemap inclusion |
| Next | Improve mobile section navigation | Pricing/FAQ reachable from a usable mobile control |
| Conditional | Reduce marketing auth/font overhead | Repeatable improvement without auth or visual regressions |
| Ongoing | Add SEO regression checks | Production public-page status/canonical/robots, schema asset size, offer-state agreement and correct 404 |

The current tests verify helpers and markup generation, but their passing result does not cover live image dimensions, offer availability or search indexing. Adding tests around those actual failure modes is more valuable than adding rigid keyword-density, word-count or title-length targets.
