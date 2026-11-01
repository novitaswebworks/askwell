import { z } from "zod";
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
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  buttonColor: "#000000",
  position: "bottom-right",
  label: "Chat with us",
  animation: "fade",
  headerText: "How can we help?",
  showBadge: true,
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
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

// ---------------------------------------------------------------- owner routes

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  about: z.string(),
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
  })
  .refine((v) => v.name !== undefined || v.about !== undefined, "Provide a name or a description");
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addTextKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(200_000),
});
export type AddTextKnowledgeInput = z.infer<typeof addTextKnowledgeSchema>;

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
  createdAt: z.string(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["visitor", "bot"]),
  body: z.string(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

export const updateConfigSchema = widgetConfigSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  "Provide at least one field",
);
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
