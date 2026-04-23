import { jsonrepair } from "jsonrepair";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a JSON-only API. Respond with valid JSON only. No markdown, no backticks. Use straight double quotes for JSON syntax. Inside string values, never use double quotes - use single quotes or angle brackets instead. Escape special characters properly.`;

const buildUserPrompt = (text) => `Analyze this Chinese text sentence by sentence. Be AGGRESSIVE in finding vagueness — err on the side of marking MORE, not less. A good analysis marks 3-5 ambiguous phrases per typical sentence.

Text: ${text}

Schema:
{"sentences":[{"text":"original sentence","abstraction_layer":"sensory|structure|function|strategy|value","speech_act_layer":"describe|feel|judge|claim|reason","logic_to_prev":"cause|contrast|addition|condition|concession|sequence|summary|parallel|none","ambiguous":[{"phrase":"exact substring as it appears","severity":1-3,"hint":"≤10-char Chinese hint","why_ambiguous":"one-line reason","possible_meanings":[{"interpretation":"concrete short phrase","rewrite":"drop-in replacement"}],"followup_question":"sharp Chinese question listing candidates"}],"annotation":"≤15-char editorial note"}],"layer_transitions":[{"from_idx":0,"to_idx":1,"description":"≤30-char explanation"}]}

What to mark as ambiguous (cast a WIDE net, 5 categories):

A. Modal / cognitive hedges — they hide the SOURCE of a claim:
   我觉得 / 我认为 / 感觉 / 似乎 / 好像 / 应该 / 可能
   → Is this personal gut, experience, or inference from data?
   e.g. '我觉得' → candidates: ['个人直觉', '经验判断', '观察推论']

B. Subjective adjectives without specified dimension:
   简单 / 复杂 / 好 / 不好 / 自然 / 优雅 / 合理 / 丑 / 快 / 慢
   → WHICH dimension exactly?
   e.g. '简单' → ['界面简约', '功能较少', '交互直观', '克制不堆砌']
   e.g. '不好' → ['不流畅', '结果不满意', '体验不愉快', '效率不高']

C. Abstract umbrella nouns:
   用户体验 / 效果 / 问题 / 方案 / 价值 / 质量 / 影响 / 表现
   → WHICH aspect? WHOSE? measured HOW?
   e.g. '用户体验' → ['交互体验', '视觉体验', '情感体验', '任务完成效率']

D. Degree adverbs + adjective phrase (mark the whole phrase):
   很X / 太X / 并不X / 更X / 比较X / 非常X / 特别X
   → How much? Relative to what?

E. Vague action verbs:
   做得 / 提升 / 改善 / 优化 / 搞定 / 处理 / 解决
   → Do WHAT specifically?

TARGET GRANULARITY (THIS IS THE EXPECTED LEVEL OF DETAIL):
For a sentence like '我觉得这个设计很简单，但是用户体验并不好', you MUST mark at minimum these 4 phrases:
- '我觉得' severity=1 → ['个人觉得', '经验认为']
- '很简单' severity=3 → ['界面简约', '功能较少', '交互直观']
- '用户体验' severity=2 → ['交互体验', '视觉体验', '情感体验']
- '并不好' severity=2 → ['不流畅', '结果不满意']

Rules for ambiguous entries:
1. phrase MUST be the EXACT substring as it appears in the sentence (the frontend does indexOf lookup — any deviation breaks highlighting)
2. possible_meanings: 2-4 items. Each interpretation is a CONCRETE short phrase (e.g. '界面元素少', NOT '在视觉方面'). rewrite is a drop-in word/short phrase.
3. Candidates must be genuinely DIFFERENT — picking one vs another should noticeably change the sentence's meaning
4. followup_question: pattern '你说的X，是指A、B，还是C？' — list 2-3 real candidates
5. hint: ≤10 Chinese chars
6. severity: 1=mild / 2=notably vague / 3=could cause real misunderstanding

Sentence-level fields:
- SPLITTING: Split the text ONLY at 。？！ — a 逗号/, DOES NOT start a new sentence. Comma-clauses belong to the same sentence.
  e.g. '我觉得这个设计很简单，但是用户体验并不好。因为导航太复杂，用户找不到功能。' → EXACTLY 2 sentences, NOT 4.
  Do NOT split at 、,，；: these are intra-sentence separators.
- abstraction_layer: MUST be exactly one of [sensory, structure, function, strategy, value]. Never invent new values.
- speech_act_layer: MUST be exactly one of [describe, feel, judge, claim, reason]. Never invent new values (e.g. 'predict' is NOT allowed — use 'claim' for predictions).
- logic_to_prev: MUST be exactly one of [cause, contrast, addition, condition, concession, sequence, summary, parallel, none]. Never invent new values (e.g. 'consequence' is NOT allowed — use 'cause' instead).
  HARD RULES — if the sentence STARTS with (or its first clause starts with) any cue below, you MUST use the matching logic, overriding any other judgment:
    因为/所以/因此/于是 → cause
    但是/然而/可是/不过 → contrast
    如果/若/假如/要是/倘若 → condition
    虽然/尽管 → concession
    而且/并且/同时/此外 → addition
    首先/然后/接着/最后 → sequence
    总之/综上/总的来说 → summary
    一方面…另一方面 → parallel
- annotation: ≤15 Chinese chars

layer_transitions: Include AT MOST 1-2 entries, ONLY for the single most jarring adjacent-sentence jump that genuinely damages communication. If no such jump exists, return an empty array []. Do NOT list routine transitions.

Output rules:
- Valid JSON ONLY. No markdown, no backticks.
- In Chinese string values, use single quotes '' NOT double quotes "".
- Escape special chars properly.`;

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
        max_tokens: 6144,
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
