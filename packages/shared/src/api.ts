import { z } from "zod";
import { allowedDomainsSchema } from "./domains";
import { MAX_ABOUT_LENGTH, MAX_KNOWLEDGE_FILE_BYTES, MAX_MESSAGE_LENGTH } from "./constants";

// ---------------------------------------------------------------- common

export const planSchema = z.enum(["free", "pro"]);
export const positionSchema = z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]);
export const animationSchema = z.enum(["fade", "slide", "scale"]);
export const knowledgeTypeSchema = z.enum(["text", "pdf", "md", "txt"]);
export const knowledgeStatusSchema = z.enum(["uploading", "processing", "ready", "failed"]);

export const apiErrorCodeSchema = z.enum([
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_input",
  "plan_required",
  "limit_reached",
  "quota_exceeded",
  "rate_limited",
  "message_blocked",
  "internal",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: apiErrorCodeSchema, message: z.string() }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

const publicKeySchema = z.string().regex(/^pk_[A-Za-z0-9]{8,64}$/);

// ---------------------------------------------------------------- widget config

export const widgetConfigSchema = z.object({
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: positionSchema,
  label: z.string().min(1).max(40),
  animation: animationSchema,
  headerText: z.string().min(1).max(60),
  showBadge: z.boolean(),
  welcomeMessage: z.string().trim().min(1).max(200),
  starterQuestions: z.array(z.string().trim().min(1).max(100)).max(4),
  greetingEnabled: z.boolean(),
  greetingText: z.string().trim().min(1).max(120),
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  buttonColor: "#000000",
  position: "bottom-right",
  label: "Chat with us",
  animation: "fade",
  headerText: "How can we help?",
  showBadge: true,
  welcomeMessage: "Ask a question and we'll reply right here.",
  starterQuestions: [
    "What services do you offer?",
    "How do I get started?",
    "How can I contact you?",
  ],
  greetingEnabled: false,
  greetingText: "Hi! Need a hand? Ask me anything.",
};

// ---------------------------------------------------------------- public routes

export const widgetConfigQuerySchema = z.object({ key: publicKeySchema });
export type WidgetConfigQuery = z.infer<typeof widgetConfigQuerySchema>;
export type WidgetConfigResponse = WidgetConfig;

export const chatRequestSchema = z.object({
  key: publicKeySchema,
  visitorId: z.string().min(8).max(64),
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  conversationId: z.uuid(),
  reply: z.string(),
  sources: z.array(z.string()).optional(),
  followUps: z.array(z.string()).optional(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

// POST /api/projects/:id/test: the owner tries a question and sees how it was answered.
export const testAnswerRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});
export type TestAnswerRequest = z.infer<typeof testAnswerRequestSchema>;

export const testAnswerResponseSchema = z.object({
  kind: z.enum(["question", "human", "smalltalk", "off_topic"]),
  reply: z.string(),
  understoodAs: z.string().nullable(),
  chunks: z.array(
    z.object({
      title: z.string(),
      similarity: z.number(),
      used: z.boolean(),
      excerpt: z.string(),
    }),
  ),
  followUps: z.array(z.string()),
  ms: z.object({ understand: z.number(), search: z.number(), answer: z.number() }),
});
export type TestAnswerResponse = z.infer<typeof testAnswerResponseSchema>;

// ---------------------------------------------------------------- owner routes

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  about: z.string(),
  allowedDomains: z.array(z.string()),
  publicKey: publicKeySchema,
  messagesUsed: z.number().int().nonnegative(),
  periodStart: z.string(),
  createdAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const createProjectSchema = z.object({ name: z.string().trim().min(1).max(100) });
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const renameProjectSchema = createProjectSchema;
export type RenameProjectInput = z.infer<typeof renameProjectSchema>;

// PATCH /api/projects/:id: rename, describe the business, or both.
export const updateProjectSchema = z
  .object({
    name: createProjectSchema.shape.name.optional(),
    about: z.string().trim().max(MAX_ABOUT_LENGTH).optional(),
    allowedDomains: allowedDomainsSchema.optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.about !== undefined || v.allowedDomains !== undefined,
    "Provide a name, a description or allowed domains",
  );
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// POST /api/projects/:id/knowledge/url: read a website and return the text for the owner to
// review. Nothing is saved; the reviewed text is added through POST /api/projects/:id/knowledge.
export const addUrlKnowledgeSchema = z.object({ url: z.string().trim().min(1).max(2048) });
export type AddUrlKnowledgeInput = z.infer<typeof addUrlKnowledgeSchema>;

export const websitePreviewSchema = z.object({
  title: z.string(),
  text: z.string(),
  pages: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  // Very little text was found: the site may draw its content with JavaScript, which we cannot read.
  sparse: z.boolean(),
});
export type WebsitePreview = z.infer<typeof websitePreviewSchema>;

export const addTextKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(200_000),
});
export type AddTextKnowledgeInput = z.infer<typeof addTextKnowledgeSchema>;

export const MAX_ANSWER_ITEMS = 80;
// The database refuses an `answers` value over 100,000 bytes, and 80 items of the maximum length would be
// about 184,000. Stop it here, with a clear message, instead of failing at the database.
export const MAX_ANSWERS_BYTES = 95_000;
export const saveAnswersSchema = z
  .object({
    template: z.string().trim().min(1).max(40),
    items: z
      .array(
        z.object({
          question: z.string().trim().min(1).max(300),
          answer: z.string().trim().min(1).max(2000),
        }),
      )
      .min(1)
      .max(MAX_ANSWER_ITEMS),
  })
  .refine((v) => new TextEncoder().encode(JSON.stringify(v)).length <= MAX_ANSWERS_BYTES, {
    message: "The answers are too long in total.",
  });
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;

export const knowledgeUploadUrlRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_KNOWLEDGE_FILE_BYTES),
  type: knowledgeTypeSchema.exclude(["text"]),
});
export type KnowledgeUploadUrlRequest = z.infer<typeof knowledgeUploadUrlRequestSchema>;

export const knowledgeUploadUrlResponseSchema = z.object({
  sourceId: z.uuid(),
  uploadUrl: z.url(),
});
export type KnowledgeUploadUrlResponse = z.infer<typeof knowledgeUploadUrlResponseSchema>;

export const knowledgeFinalizeSchema = z.object({ sourceId: z.uuid() });
export type KnowledgeFinalizeInput = z.infer<typeof knowledgeFinalizeSchema>;

export const knowledgeSourceSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  type: knowledgeTypeSchema,
  status: knowledgeStatusSchema,
  createdAt: z.string(),
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  firstMessage: z.string(),
  messageCount: z.number().int().nonnegative(),
  helpful: z.number().int().nonnegative(),
  notHelpful: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["visitor", "bot"]),
  body: z.string(),
  rating: z.union([z.literal(1), z.literal(-1)]).nullable(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

// POST /api/billing/subscribe takes no body. The response carries what Razorpay
// Checkout needs to open: our subscription ID, the public key ID, and prefill.
export const subscribeResponseSchema = z.object({
  subscriptionId: z.string().min(1),
  keyId: z.string().min(1),
  name: z.string(),
  email: z.string(),
});
export type SubscribeResponse = z.infer<typeof subscribeResponseSchema>;

// GET /api/conversations/:id
export const conversationThreadSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  createdAt: z.string(),
  messages: z.array(messageSchema),
});
export type ConversationThread = z.infer<typeof conversationThreadSchema>;

export const updateConfigSchema = widgetConfigSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  "Provide at least one field",
);
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

// ---------------------------------------------------------------- ratings

// POST /api/widget/rate: thumbs up (1) or down (-1) on the latest answer; 0 takes it back.
export const rateReplyRequestSchema = z.object({
  key: publicKeySchema,
  conversationId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});
export type RateReplyRequest = z.infer<typeof rateReplyRequestSchema>;

export const rateReplyResponseSchema = z.object({ rating: z.union([z.literal(1), z.literal(-1)]).nullable() });
export type RateReplyResponse = z.infer<typeof rateReplyResponseSchema>;

// ---------------------------------------------------------------- leads (PR 2)

export const leadSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  conversationId: z.uuid().nullable(),
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(100).nullable(),
  phone: z.string().trim().max(30).nullable(),
  createdAt: z.string(),
});
export type Lead = z.infer<typeof leadSchema>;

export const captureLeadRequestSchema = z.object({
  key: publicKeySchema,
  // Missing when the very first message was refused (quota, outage): the visitor can still leave an email.
  conversationId: z.uuid().optional(),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  type: z.enum(["inquiry", "handoff"]).default("inquiry"),
});
export type CaptureLeadRequest = z.infer<typeof captureLeadRequestSchema>;

export const captureLeadResponseSchema = z.object({
  success: z.boolean(),
  leadId: z.uuid(),
});
export type CaptureLeadResponse = z.infer<typeof captureLeadResponseSchema>;

