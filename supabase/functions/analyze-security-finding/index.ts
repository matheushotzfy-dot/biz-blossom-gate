import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { streamText } from "npm:ai@5";
import { baseHeaders, json, logSecurityEvent, preflight, safeError } from "../_shared/security.ts";

const MODEL = "openai/gpt-6-astra";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

type Analysis = {
  risk_level: "low" | "medium" | "high" | "critical";
  summary: string;
  recommendations: Array<{ priority: number; title: string; action: string; rationale: string }>;
};

function validAnalysis(value: unknown): value is Analysis {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["low", "medium", "high", "critical"].includes(String(item.risk_level))
    && typeof item.summary === "string"
    && Array.isArray(item.recommendations)
    && item.recommendations.length > 0
    && item.recommendations.length <= 8;
}

Deno.serve(async (req) => {
  const cors = baseHeaders(req);
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return json(req, { success: false, error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const gatewayKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(req, { success: false, error: "Não autorizado" }, 401);

  let findingId = "";
  let callerId = "";
  try {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.slice(7);
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    callerId = String(claimsData?.claims?.sub ?? "");
    if (claimsError || !callerId) return json(req, { success: false, error: "Não autorizado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (isAdmin !== true) return json(req, { success: false, error: "Acesso exclusivo do administrador" }, 403);

    const body = await req.json().catch(() => ({}));
    findingId = typeof body?.findingId === "string" ? body.findingId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(findingId)) return json(req, { success: false, error: "Achado inválido" }, 400);

    const { data: finding, error: findingError } = await admin
      .from("security_findings")
      .select("id, source, title, description, evidence")
      .eq("id", findingId)
      .single();
    if (findingError || !finding) return json(req, { success: false, error: "Achado não encontrado" }, 404);
    if (!gatewayKey) return json(req, { success: false, error: "Análise de IA indisponível" }, 503);

    await admin.from("security_findings").update({ status: "analyzing", error_message: null }).eq("id", findingId);

    let runId = req.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    const gatewayFetch: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ||= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return response;
    };
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: gatewayKey,
      headers: { "Lovable-API-Key": gatewayKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: gatewayFetch,
    });

    const result = streamText({
      model: openai.responses(MODEL),
      system: "Você é um arquiteto de segurança de pagamentos. Classifique apenas pelo conteúdo fornecido. Não invente evidências. Responda somente JSON válido, sem markdown, no formato: {\"risk_level\":\"low|medium|high|critical\",\"summary\":\"resumo objetivo\",\"recommendations\":[{\"priority\":1,\"title\":\"título\",\"action\":\"correção concreta\",\"rationale\":\"por que priorizar\"}]}. Ordene recomendações por prioridade e gere no máximo 8.",
      prompt: JSON.stringify({ source: finding.source, title: finding.title, description: finding.description, evidence: finding.evidence }),
      abortSignal: req.signal,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
    });
    const text = await result.text;
    const parsed = JSON.parse(text.trim()) as unknown;
    if (!validAnalysis(parsed)) throw new Error("Resposta de análise inválida");

    const recommendations = parsed.recommendations
      .map((item, index) => ({ priority: index + 1, title: String(item.title).slice(0, 160), action: String(item.action).slice(0, 1200), rationale: String(item.rationale).slice(0, 800) }));
    const { error: updateError } = await admin.from("security_findings").update({
      status: "analyzed",
      risk_level: parsed.risk_level,
      ai_summary: parsed.summary.slice(0, 3000),
      ai_recommendations: recommendations,
      ai_run_id: runId ?? null,
      analyzed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", findingId);
    if (updateError) throw updateError;

    await logSecurityEvent({ supabaseUrl, serviceKey, req, event_type: "security_finding_analyzed", endpoint: "analyze-security-finding", user_id: callerId, actor_role: "admin", status_code: 200, metadata: { finding_id: findingId, risk_level: parsed.risk_level, model: MODEL } });
    return new Response(JSON.stringify({ success: true, analysis: { ...parsed, recommendations } }), { status: 200, headers: { ...cors, "Content-Type": "application/json", ...(runId ? { [RUN_ID_HEADER]: runId } : {}) } });
  } catch (error) {
    safeError("analyze-security-finding", error);
    if (findingId && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("security_findings").update({ status: "failed", error_message: "Não foi possível concluir a análise" }).eq("id", findingId);
    }
    await logSecurityEvent({ supabaseUrl, serviceKey, req, event_type: "security_finding_analysis_failed", endpoint: "analyze-security-finding", user_id: callerId || null, actor_role: callerId ? "admin" : null, status_code: 500, metadata: { finding_id: findingId || null } });
    return json(req, { success: false, error: "Não foi possível concluir a análise" }, 500);
  }
});