import { jsonrepair } from "jsonrepair";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a JSON-only API. Respond with valid JSON only. No markdown, no backticks. Use straight double quotes for JSON syntax. Inside string values, never use double quotes - use single quotes or angle brackets instead. Escape special characters properly.`;

const buildUserPrompt = (text) => `Analyze this Chinese text. Return ONLY valid JSON.

Text: ${text}

Schema:
{"sentences":[{"text":"original sentence","abstraction_layer":"sensory|structure|function|strategy|value","speech_act_layer":"describe|feel|judge|claim|reason","logic_to_prev":"cause|contrast|addition|condition|concession|sequence|summary|parallel|none","ambiguous":[{"phrase":"the ambiguous word/phrase exactly as it appears in text","severity":1-3,"hint":"10-char hint shown on hover","why_ambiguous":"one line explanation","possible_meanings":[{"interpretation":"meaning","rewrite":"precise alternative"}],"followup_question":"sharp Socratic question"}],"annotation":"15-char editorial note on this sentence"}],"layer_transitions":[{"from_idx":0,"to_idx":1,"description":"30-char explanation of this layer jump"}]}

Rules:
1. Split by 。？！
2. severity: 1=slightly ambiguous, 2=notably ambiguous, 3=very ambiguous/could cause misunderstanding
3. Find ALL ambiguous expressions aggressively:
   - Adjectives: 简单/复杂/好/不好/自然/优雅/合理 - what specific kind?
   - Noun phrases: 用户体验/效果/问题/方案 - which aspect? whose?
   - Degree adverbs: 很/太/并不/更/比较 - how much?
   - Verbs: 做得/找不到/提升/改善 - do what specifically?
4. followup_question: sharp Socratic questions in Chinese, the most important field
5. hint: very short Chinese hint for hover tooltip (max 10 chars like '哪种简单？')
6. annotation: ultra-short Chinese note (max 15 chars)
7. All Chinese content in string values must use single quotes instead of double quotes
8. layer_transitions only when jumps cause real communication problems`;

export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "文本为空" }, { status: 400 });
    }

    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "服务器未配置 KIMI_API_KEY" }, { status: 500 });
    }
    const model = process.env.KIMI_MODEL || "moonshot-v1-32k";

    const resp = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(text) },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return Response.json(
        { error: `Kimi API ${resp.status}: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "";

    let jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const fb = jsonStr.indexOf("{");
    const lb = jsonStr.lastIndexOf("}");
    if (fb !== -1 && lb !== -1) jsonStr = jsonStr.slice(fb, lb + 1);
    jsonStr = jsonStr.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
    jsonStr = jsonStr.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
    jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e1) {
      try {
        parsed = JSON.parse(jsonrepair(jsonStr));
      } catch (e2) {
        const m = /position\s+(\d+)/.exec(e1.message);
        const pos = m ? parseInt(m[1], 10) : 0;
        const around = pos ? raw.slice(Math.max(0, pos - 80), pos + 80) : raw.slice(0, 400);
        return Response.json(
          {
            error: `解析 Kimi 返回失败: ${e1.message}`,
            raw_length: raw.length,
            raw_around_error: around,
          },
          { status: 502 }
        );
      }
    }

    return Response.json(parsed);
  } catch (e) {
    return Response.json({ error: `服务器错误: ${e.message}` }, { status: 500 });
  }
}
