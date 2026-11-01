import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryResult } from "@/lib/test-utils";

vi.mock("server-only", () => ({}));
const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

const ownerFrom = vi.fn();
vi.mock("@/lib/supabase/owner", () => ({
  createOwnerClient: () => ({ from: ownerFrom }),
}));

const serviceFrom = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: serviceFrom }),
}));

// Route imports
import { GET as getConversation } from "./app/api/conversations/[id]/route";
import { DELETE as deleteKnowledge } from "./app/api/knowledge/[id]/route";
import { PATCH as patchConfig } from "./app/api/projects/[id]/config/route";
import { GET as getConversations } from "./app/api/projects/[id]/conversations/route";
import { POST as postKnowledge } from "./app/api/projects/[id]/knowledge/route";
import { POST as postUploadUrl } from "./app/api/projects/[id]/knowledge/upload-url/route";
import { DELETE as deleteProject, PATCH as patchProject } from "./app/api/projects/[id]/route";

const foreignProjectId = "00000000-0000-4000-8000-000000000001";
const foreignKnowledgeId = "00000000-0000-4000-8000-000000000002";
const foreignConversationId = "00000000-0000-4000-8000-000000000003";

const pCtx = { params: Promise.resolve({ id: foreignProjectId }) };
const kCtx = { params: Promise.resolve({ id: foreignKnowledgeId }) };
const cCtx = { params: Promise.resolve({ id: foreignConversationId }) };

beforeEach(() => {
  vi.clearAllMocks();
  // Simulating Bob authenticated
  auth.mockResolvedValue({ userId: "user_bob" });
  // RLS hides Alice's project/resources from Bob (returning null/empty)
  ownerFrom.mockReturnValue(queryResult({ data: null }));
});

describe("API cross-tenant security", () => {
  it("rejects unauthorized project rename (returns 404)", async () => {
    const req = new Request("http://x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked Name" }),
    });
    const res = await patchProject(req, pCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized project deletion (returns 404)", async () => {
    const req = new Request("http://x", { method: "DELETE" });
    const res = await deleteProject(req, pCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized widget config update (returns 404)", async () => {
    const req = new Request("http://x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buttonColor: "#ff0000" }),
    });
    const res = await patchConfig(req, pCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized conversations list (returns 404)", async () => {
    const req = new Request("http://x", { method: "GET" });
    const res = await getConversations(req, pCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized knowledge addition (returns 404)", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Injected Doc", text: "Injected text content" }),
    });
    const res = await postKnowledge(req, pCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized file upload URL generation (returns 404)", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Doc", filename: "doc.pdf", size: 1000, type: "pdf" }),
    });
    const res = await postUploadUrl(req, pCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized knowledge deletion (returns 404)", async () => {
    const req = new Request("http://x", { method: "DELETE" });
    const res = await deleteKnowledge(req, kCtx);
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized conversation thread inspection (returns 404)", async () => {
    const req = new Request("http://x", { method: "GET" });
    const res = await getConversation(req, cCtx);
    expect(res.status).toBe(404);
  });
});
