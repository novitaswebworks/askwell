// The logo mark as plain SVG with fixed colours, for generated images (favicon, share
// image), which cannot read the page's CSS variables. Same drawing as components/site/logo.tsx.
export const BRAND_COLOR = "#e8590c";

export function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" fill={BRAND_COLOR} />
      <path
        d="M9 10.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3v-3H9A1.5 1.5 0 0 1 7.5 19v-7A1.5 1.5 0 0 1 9 10.5Z"
        fill="#ffffff"
      />
      <path d="M12.5 15.6l2.2 2.2 4.3-4.3" stroke={BRAND_COLOR} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
