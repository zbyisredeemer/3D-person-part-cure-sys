import assert from "node:assert/strict";
import test from "node:test";
import {
  answerHealthQuestion,
  HealthServiceError,
  isOnline,
  validateQuestion,
} from "../server/health-service";
import { generateEducationalReply } from "../src/lib/health";
import { sources } from "../src/data/medical";

const config = {
  apiKey: "test-only-secret-do-not-echo",
  model: "configured-test-model",
  baseUrl: "https://provider.example/v1/",
};
const safeAnswer = () => ({
  sections: [
    {
      title: "常见可能原因",
      items: ["咳嗽可能与气道刺激有关，不能据此作出诊断。"],
    },
    { title: "需要观察的信息", items: ["记录持续时间、诱因和伴随症状。"] },
    { title: "自我护理建议", items: ["避免烟雾刺激，保持规律作息。"] },
    {
      title: "需要就医的危险信号",
      items: ["严重呼吸困难应立即联系当地急救服务，中国大陆为 120。"],
    },
  ],
  urgent: false,
});
const output = (answer: unknown) => ({
  status: "completed",
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(answer) }],
    },
  ],
});
const mockResponse =
  (value: unknown, status = 200): typeof fetch =>
  async () =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    });
const neverRequest: typeof fetch = async () => {
  throw new Error("Unexpected provider request");
};

async function rejectsSafely(action: () => Promise<unknown>, status: number) {
  await assert.rejects(action, (error: unknown) => {
    assert(
      error instanceof HealthServiceError,
      "must expose a controlled service error",
    );
    assert.equal(error.status, status);
    assert.doesNotMatch(
      error.message,
      /test-only-secret|Bearer |provider\.example|PRIVATE_HEALTH_TEXT/,
    );
    return true;
  });
}

test("local mode works without an online configuration and never needs a provider", async () => {
  const body = { question: "如何保护心脏？" };
  const result = await answerHealthQuestion(body, {}, neverRequest);
  assert.equal(result.mode, "local");
  assert.deepEqual(result.answer, generateEducationalReply(body.question));
  assert.equal(isOnline({ apiKey: " ", model: "model" }), false);
  assert.equal(isOnline({ apiKey: "key", model: " " }), false);
  assert.equal(isOnline(config), true);
});

test("emergency symptoms bypass even a configured online provider", async () => {
  let requested = false;
  const request: typeof fetch = async () => {
    requested = true;
    return mockResponse(output(safeAnswer()))("https://unused.example");
  };
  const result = await answerHealthQuestion(
    { question: "胸口疼，呼吸困难并出冷汗" },
    config,
    request,
  );
  assert.equal(requested, false);
  assert.equal(result.mode, "local");
  assert.equal(result.answer.urgent, true);
  assert.match(
    result.answer.sections.flatMap((section) => section.items).join(""),
    /120/,
  );
  assert.match(result.notice ?? "", /没有发送/);
});

test("follow-up context conservatively retains earlier red flags", async () => {
  const result = await answerHealthQuestion(
    {
      question: "现在缓解了，还有什么要注意？",
      context: "胸痛，呼吸困难和冷汗",
    },
    config,
    neverRequest,
  );
  assert.equal(result.answer.urgent, true);
  assert.equal(result.mode, "local");
});

test("invalid, blank and oversized input is rejected before any provider request", async () => {
  const invalid: unknown[] = [
    null,
    [],
    "question",
    {},
    { question: 3 },
    { question: "" },
    { question: " \n " },
    { question: "字".repeat(501) },
    { question: "咳嗽", context: 7 },
    { question: "咳嗽", context: [] },
    { question: "咳嗽", context: "字".repeat(501) },
  ];
  for (const body of invalid)
    await rejectsSafely(
      () => answerHealthQuestion(body, config, neverRequest),
      400,
    );
  assert.deepEqual(
    validateQuestion({ question: "  咳嗽  ", context: "  感冒  " }),
    { question: "咳嗽", context: "感冒" },
  );
  assert.equal(
    validateQuestion({ question: "字".repeat(500) }).question.length,
    500,
  );
});

test("online mode sends the configured model and returns structured sourced content", async () => {
  let requestCount = 0;
  const request: typeof fetch = async (url, init) => {
    requestCount++;
    assert.equal(String(url), "https://provider.example/v1/responses");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      `Bearer ${config.apiKey}`,
    );
    assert(init?.signal instanceof AbortSignal);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.model, config.model);
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.type, "json_schema");
    assert.equal(payload.text.format.strict, true);
    assert.match(payload.instructions, /绝不诊断/);
    assert.match(payload.input.at(-1).content, /前一问题：感冒/);
    assert.match(payload.input.at(-1).content, /当前问题：咳嗽需要观察什么/);
    return new Response(
      JSON.stringify(
        output({ ...safeAnswer(), sourceIds: ["invented-source"] }),
      ),
    );
  };
  const result = await answerHealthQuestion(
    { question: "咳嗽需要观察什么", context: "感冒" },
    config,
    request,
  );
  assert.equal(requestCount, 1);
  assert.equal(result.mode, "online");
  assert.equal(result.answer.sections.length, 4);
  assert.equal(result.answer.urgent, false);
  assert(result.answer.sourceIds.length > 0);
  assert(!result.answer.sourceIds.includes("invented-source"));
  for (const id of result.answer.sourceIds)
    assert(
      sources.some((source) => source.id === id),
      id,
    );
});

test("online urgency may escalate a local answer and cannot reach provider for local emergencies", async () => {
  const response = await answerHealthQuestion(
    { question: "我咳嗽" },
    config,
    mockResponse(output({ ...safeAnswer(), urgent: true })),
  );
  assert.equal(response.answer.urgent, true);
  const emergency = await answerHealthQuestion(
    { question: "胸痛伴呼吸困难" },
    config,
    mockResponse(output({ ...safeAnswer(), urgent: false })),
  );
  assert.equal(emergency.answer.urgent, true);
  assert.equal(emergency.mode, "local");
});

test("online medication quantities, frequencies and courses are rejected", async (t) => {
  const forbidden = [
    "服用 500 mg 药物。",
    "建议吃两片药。",
    "用量为 0.5 g。",
    "服药频次：每日两次。",
    "连续服药五天。",
  ];
  for (const text of forbidden)
    await t.test(text, async () => {
      const answer = safeAnswer();
      answer.sections[2].items = [text];
      await rejectsSafely(
        () =>
          answerHealthQuestion(
            { question: "我咳嗽" },
            config,
            mockResponse(output(answer)),
          ),
        502,
      );
    });
});

test("education boundaries also apply to section headings", async () => {
  const answer = safeAnswer();
  answer.sections[2].title = "服用 500 mg 药物";
  await rejectsSafely(
    () =>
      answerHealthQuestion(
        { question: "我咳嗽" },
        config,
        mockResponse(output(answer)),
      ),
    502,
  );
});

test("online diagnoses and treatment guarantees are rejected", async (t) => {
  for (const text of [
    "你已确诊肺炎。",
    "你患有肺炎。",
    "保证治愈。",
    "这个方法一定能治好。",
  ])
    await t.test(text, async () => {
      const answer = safeAnswer();
      answer.sections[0].items = [text];
      await rejectsSafely(
        () =>
          answerHealthQuestion(
            { question: "我咳嗽" },
            config,
            mockResponse(output(answer)),
          ),
        502,
      );
    });
});

test("malformed, incomplete, refused and structurally invalid model output is rejected", async (t) => {
  const cases: [string, unknown][] = [
    ["null payload", null],
    [
      "incomplete generation",
      { ...output(safeAnswer()), status: "incomplete" },
    ],
    ["missing output", { status: "completed" }],
    [
      "refusal even with answer text",
      {
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "refusal", refusal: "Cannot answer" },
              { type: "output_text", text: JSON.stringify(safeAnswer()) },
            ],
          },
        ],
      },
    ],
    [
      "invalid JSON text",
      {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "<not JSON>" }],
          },
        ],
      },
    ],
    [
      "wrong section count",
      output({ ...safeAnswer(), sections: safeAnswer().sections.slice(0, 3) }),
    ],
    ["urgent must be boolean", output({ ...safeAnswer(), urgent: "false" })],
    [
      "empty title",
      output({
        ...safeAnswer(),
        sections: safeAnswer().sections.map((section, i) =>
          i === 0 ? { ...section, title: "  " } : section,
        ),
      }),
    ],
    [
      "empty item list",
      output({
        ...safeAnswer(),
        sections: safeAnswer().sections.map((section, i) =>
          i === 0 ? { ...section, items: [] } : section,
        ),
      }),
    ],
    [
      "blank item",
      output({
        ...safeAnswer(),
        sections: safeAnswer().sections.map((section, i) =>
          i === 0 ? { ...section, items: [" "] } : section,
        ),
      }),
    ],
    [
      "oversized item",
      output({
        ...safeAnswer(),
        sections: safeAnswer().sections.map((section, i) =>
          i === 0 ? { ...section, items: ["字".repeat(651)] } : section,
        ),
      }),
    ],
  ];
  for (const [name, value] of cases)
    await t.test(name, async () => {
      await rejectsSafely(
        () =>
          answerHealthQuestion(
            { question: "我咳嗽" },
            config,
            mockResponse(value),
          ),
        502,
      );
    });
});

test("provider failures never expose keys, submitted health text or raw response details", async () => {
  const request: typeof fetch = async () => {
    throw new Error(
      `Bearer ${config.apiKey}; PRIVATE_HEALTH_TEXT; provider.example`,
    );
  };
  await rejectsSafely(
    () =>
      answerHealthQuestion(
        { question: "PRIVATE_HEALTH_TEXT" },
        config,
        request,
      ),
    502,
  );
  await rejectsSafely(
    () =>
      answerHealthQuestion(
        { question: "我咳嗽" },
        config,
        mockResponse({ error: `Bearer ${config.apiKey}` }, 429),
      ),
    502,
  );
  const invalidJson: typeof fetch = async () =>
    new Response(`invalid JSON: ${config.apiKey}`);
  await rejectsSafely(
    () => answerHealthQuestion({ question: "我咳嗽" }, config, invalidJson),
    502,
  );
});

test("insecure and malformed provider URLs use controlled configuration errors", async () => {
  await rejectsSafely(
    () =>
      answerHealthQuestion(
        { question: "我咳嗽" },
        { ...config, baseUrl: "http://provider.example/v1" },
        neverRequest,
      ),
    503,
  );
  await rejectsSafely(
    () =>
      answerHealthQuestion(
        { question: "我咳嗽" },
        { ...config, baseUrl: `not-a-url-${config.apiKey}` },
        neverRequest,
      ),
    503,
  );
});
