// Everything the Install page says, as plain functions and data, so it is tested
// and the wording lives in one place. The key in the snippet is public by design:
// it only identifies a project and grants no access to anything.

export function buildSnippet(appUrl: string, publicKey: string): string {
  return `<script src="${appUrl.replace(/\/$/, "")}/widget.js" data-key="${publicKey}"></script>`;
}

export interface Platform {
  id: string;
  label: string;
  intro?: string;
  steps: string[];
  note?: string;
}

// Menu names change; each platform says what to look for, not just where to click.
export const PLATFORMS: Platform[] = [
  {
    id: "wordpress",
    label: "WordPress",
    steps: [
      "Sign in to your WordPress admin and open Plugins, then Add New.",
      "Search for “WPCode”, install it and press Activate.",
      "In the new Code Snippets menu, open Header & Footer.",
      "Paste your code into the Footer box and press Save Changes.",
      "Open your website in a new tab and reload it. The chat button appears in a corner.",
    ],
    note: "If a cache or security plugin is installed, clear its cache after saving.",
  },
  {
    id: "shopify",
    label: "Shopify",
    steps: [
      "In your Shopify admin open Online Store, then Themes.",
      "Next to your live theme press the three dots, then Edit code. (First choose Duplicate if you want a backup.)",
      "Open the file theme.liquid in the Layout folder.",
      "Scroll to the very bottom and paste your code on its own line just above the closing </body> tag.",
      "Press Save, then open your shop and reload it. The chat button appears in a corner.",
    ],
  },
  {
    id: "wix",
    label: "Wix",
    steps: [
      "In your Wix dashboard open Settings, then Custom Code (under Advanced).",
      "Press Add Custom Code and paste your code into the box.",
      "Name it “Askwell”, choose All pages, and choose to place it in Body – end.",
      "Press Apply, then Publish your site.",
      "Open your published website and reload it. The chat button appears in a corner.",
    ],
    note: "Wix only allows custom code on a paid plan with a connected domain.",
  },
  {
    id: "squarespace",
    label: "Squarespace",
    steps: [
      "Open Settings, then Advanced, then Code Injection.",
      "Paste your code into the Footer box.",
      "Press Save.",
      "Open your website and reload it. The chat button appears in a corner.",
    ],
    note: "Code Injection is only available on Squarespace's Business plan and above.",
  },
  {
    id: "webflow",
    label: "Webflow",
    steps: [
      "Open Site settings for your project, then the Custom code tab.",
      "Paste your code into Footer code (before the </body> tag).",
      "Press Save changes, then Publish your site.",
      "Open your published website and reload it. The chat button appears in a corner.",
    ],
    note: "Custom code needs a paid Webflow site plan.",
  },
  {
    id: "html",
    label: "My own HTML files",
    steps: [
      "Open the HTML page (or the shared footer file) in your editor.",
      "Paste your code on its own line just above the closing </body> tag.",
      "Save the file and upload it to your web host the way you normally do.",
      "Open the page and reload it. The chat button appears in a corner.",
    ],
    note: "Put it on every page where you want the chat.",
  },
  {
    id: "other",
    label: "Something else",
    intro: "Almost every website builder has a place for your own code.",
    steps: [
      "Look in your website builder's settings for words like Custom code, Code injection, Header and footer, Scripts or Embed.",
      "Choose the Footer, or End of body, and make it apply to all pages.",
      "Paste your code, save, and publish your site if the builder has a Publish button.",
      "Open your website and reload it. The chat button appears in a corner.",
    ],
    note: "Stuck? Use the AI helper below, or send the message to whoever looks after your website.",
  },
];

export const AI_TOOLS = [
  { label: "ChatGPT", href: "https://chatgpt.com/" },
  { label: "Claude", href: "https://claude.ai/new" },
  { label: "Gemini", href: "https://gemini.google.com/app" },
] as const;

// A prompt for any AI chat tool. It sends the person step by step and keeps the AI
// from asking for anything private.
export function buildAiPrompt(snippet: string): string {
  return [
    "I run a website but I am not technical. Please help me add a chat assistant to it. Use plain language, be patient, and give me one short step at a time.",
    "",
    "What I am adding: Askwell, a chat assistant that answers my visitors' questions. It needs one line of code, called a script tag, pasted into my website so it loads on every page. This code is safe to share: the key inside it is public and gives no access to my account.",
    "",
    "My code:",
    snippet,
    "",
    "What I need from you:",
    "1. First ask me what my website is built with (for example WordPress, Shopify, Wix, Squarespace, Webflow, or plain HTML files) and whether I can sign in to its admin area. If I do not know, help me work it out.",
    "2. Then give me short numbered steps to paste the code so it loads on every page, near the end of the page (just before the closing </body> tag, or in the site-wide Footer custom code box). Name the exact menu items to look for. If your knowledge of those menus might be out of date, say so and tell me what words to look for instead.",
    "3. After I save, tell me how to publish or update my site and how to check that a chat button now appears in a bottom corner of my website.",
    "4. If the button does not appear, help me find out why (a cache that needs clearing, a plan that does not allow custom code, the code pasted in the wrong box, or a security plugin removing it).",
    "",
    "Rules: never ask for my password, login codes or payment details. I will do all the clicking myself. Do not suggest changing anything else on my site. If something needs a web developer, tell me, and write a short message I can send them.",
  ].join("\n");
}

export function buildDeveloperMessage(snippet: string): string {
  return [
    "Hello,",
    "",
    "Could you please add the line of code below to our website, so that it loads on every page? Put it just before the closing </body> tag, or in the site-wide footer scripts.",
    "",
    snippet,
    "",
    "It adds a chat assistant (Askwell) that answers visitors' questions. Nothing else needs to change. Once it is live, a chat button appears in a corner of every page.",
    "",
    "Thank you!",
  ].join("\n");
}

export function mailtoLink(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type Connection =
  | { state: "waiting" }
  | { state: "connected"; host: string; ageMinutes: number; quiet: boolean };

// "Connected" once the widget has loaded on the owner's site. "Quiet" means it was
// last seen more than a week ago, which usually means the code was removed.
export function connectionState(seenAt: string | null, host: string | null, now: number): Connection {
  if (!seenAt || !host) return { state: "waiting" };
  const at = Date.parse(seenAt);
  if (Number.isNaN(at)) return { state: "waiting" };
  const ageMinutes = Math.max(0, Math.round((now - at) / 60_000));
  return { state: "connected", host, ageMinutes, quiet: ageMinutes > 7 * 24 * 60 };
}

export function describeAge(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

export function hostLabel(host: string): string {
  return host === "localhost" ? "your own computer (localhost)" : host;
}
