import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  HeartPulse,
  Info,
  Layers3,
  MessageCircle,
  MousePointer2,
  Pill,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import { diseases, drugs, organs, sources } from "../data/medical";
import { generateEducationalReply } from "../lib/health";
import "./knowledge.css";

function SourceLinks({ ids }: { ids: string[] }) {
  const selected = ids
    .map((id) => sources.find((source) => source.id === id))
    .filter((source) => source !== undefined);
  if (!selected.length) return null;
  return (
    <div className="kv-sources">
      <span>参考资料</span>
      {selected.map((source) => (
        <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
          {source.organization} · {source.title}
          <ExternalLink size={11} />
          <span className="kv-sr-only">，在新窗口打开</span>
        </a>
      ))}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="kv-search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="kv-icon-button"
          onClick={() => onChange("")}
          aria-label="清空搜索"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

function InfoList({
  title,
  items,
  icon,
  warning = false,
}: {
  title: string;
  items: string[];
  icon: ReactNode;
  warning?: boolean;
}) {
  return (
    <section
      className={`kv-info-section${warning ? " kv-warning-section" : ""}`}
    >
      <h3>
        {icon}
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            {warning ? <span className="kv-list-dot" /> : <Check size={14} />}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DiseaseLibrary({
  initialDisease,
  onSelectOrgan,
}: {
  initialDisease?: string;
  onSelectOrgan: (id: string) => void;
}) {
  const initialMatch = diseases.find(
    (disease) =>
      disease.id === initialDisease || disease.name === initialDisease,
  );
  const [query, setQuery] = useState(
    initialDisease && !initialMatch ? initialDisease : "",
  );
  const [category, setCategory] = useState("全部");
  const [selectedId, setSelectedId] = useState(
    initialMatch?.id || diseases[0]?.id,
  );
  const [openDrug, setOpenDrug] = useState<string | null>(null);
  useEffect(() => {
    if (initialDisease) {
      const match = diseases.find(
        (disease) =>
          disease.id === initialDisease || disease.name === initialDisease,
      );
      setSelectedId(match?.id || "");
      setCategory("全部");
      setQuery(match ? "" : initialDisease);
    }
  }, [initialDisease]);
  const categories = useMemo(
    () => ["全部", ...new Set(diseases.map((disease) => disease.category))],
    [],
  );
  const filtered = diseases.filter(
    (disease) =>
      (category === "全部" || disease.category === category) &&
      `${disease.name} ${disease.summary} ${disease.symptoms.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected =
    filtered.find((disease) => disease.id === selectedId) || filtered[0];
  const selectedDrug = drugs.find((drug) => drug.id === openDrug);
  return (
    <section className="kv-page kv-diseases" aria-label="疾病百科">
      <div className="kv-library-layout">
        <aside className="kv-library-sidebar" aria-label="疾病筛选">
          <div className="kv-sidebar-heading">
            <h2>常见疾病</h2>
            <span>{diseases.length} 个主题</span>
          </div>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="搜索疾病、症状"
          />
          <div className="kv-filter-row" aria-label="疾病分类">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={category === item}
                className={
                  category === item ? "kv-filter kv-active" : "kv-filter"
                }
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="kv-disease-list" aria-label="疾病列表">
            {filtered.map((disease) => (
              <button
                type="button"
                key={disease.id}
                className={`kv-disease-item${selected?.id === disease.id ? " kv-selected" : ""}`}
                aria-current={selected?.id === disease.id ? "true" : undefined}
                onClick={() => setSelectedId(disease.id)}
              >
                <span className="kv-disease-icon">
                  <Activity size={19} />
                </span>
                <span>
                  <strong>{disease.name}</strong>
                  <small>{disease.category}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {!filtered.length && (
              <div className="kv-empty">
                <Search size={25} />
                <strong>暂未找到相关主题</strong>
                <p>试试“感冒”“咳嗽”，或切换分类。</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("全部");
                  }}
                >
                  查看全部疾病
                </button>
              </div>
            )}
          </div>
          <div className="kv-sidebar-note">
            <ShieldCheck size={18} />
            <p>
              了解知识是第一步。
              <br />
              具体诊疗请咨询专业医生。
            </p>
          </div>
        </aside>
        {selected ? (
          <article className="kv-detail" key={selected.id}>
            <div className="kv-detail-topline">
              <span className="kv-category-label">{selected.category}</span>
              <span>
                <BookOpen size={13} /> 医学科普
              </span>
            </div>
            <h2>{selected.name}</h2>
            <p className="kv-detail-summary">{selected.summary}</p>
            <div className="kv-related-organs">
              {selected.organIds.map((id) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => onSelectOrgan(id)}
                >
                  <Layers3 size={14} />在 3D 中查看
                  {organs.find((organ) => organ.id === id)?.name || "相关器官"}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
            <section className="kv-symptom-tags">
              <h3>可能出现的症状</h3>
              <div>
                {selected.symptoms.map((symptom) => (
                  <span key={symptom}>{symptom}</span>
                ))}
              </div>
              <p>症状可能有多种原因，不能据此自行确诊。</p>
            </section>
            <div className="kv-detail-grid">
              <InfoList
                title="基础照护"
                items={selected.care}
                icon={<HeartPulse size={18} />}
              />
              <section className="kv-info-section">
                <h3>
                  <Pill size={18} />
                  相关药物知识
                </h3>
                <p className="kv-small-copy">
                  了解药物的作用和注意事项，使用前咨询医生或药师。
                </p>
                <div className="kv-drug-reference-list">
                  {selected.drugIds.map((id) => {
                    const drug = drugs.find((item) => item.id === id);
                    return drug ? (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setOpenDrug(id)}
                      >
                        <span>
                          <strong>{drug.name}</strong>
                          <small>{drug.category}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ) : null;
                  })}
                </div>
                {!selected.drugIds.length && (
                  <p className="kv-small-copy">
                    治疗方式需要由医生结合具体情况评估。
                  </p>
                )}
              </section>
            </div>
            <InfoList
              title="需要留意"
              items={selected.warnings}
              icon={<TriangleAlert size={18} />}
              warning
            />
            <SourceLinks ids={selected.sourceIds} />
          </article>
        ) : (
          <article className="kv-detail kv-detail-empty">
            <BookOpen size={46} strokeWidth={1} />
            <h2>从一个健康问题开始</h2>
            <p>调整左侧搜索或分类，阅读相关科普内容。</p>
          </article>
        )}
      </div>
      {selectedDrug && (
        <Modal
          title="药物知识"
          eyebrow="MEDICATION GUIDE"
          onClose={() => setOpenDrug(null)}
        >
          <DrugDetail drug={selectedDrug} />
        </Modal>
      )}
    </section>
  );
}

type Drug = (typeof drugs)[number];

function DrugDetail({ drug }: { drug: Drug }) {
  return (
    <article className="kv-drug-detail">
      <span className="kv-category-label">{drug.category}</span>
      <h3 className="kv-drug-detail-title">{drug.name}</h3>
      <p className="kv-detail-summary">{drug.purpose}</p>
      <div className="kv-medical-notice">
        <Info size={16} />
        <p>以下为药物科普，不是用药推荐。本平台不提供处方或具体剂量。</p>
      </div>
      <InfoList
        title="适用情况"
        items={drug.indications}
        icon={<Check size={17} />}
      />
      <InfoList
        title="常见副作用"
        items={drug.sideEffects}
        icon={<Activity size={17} />}
      />
      <InfoList
        title="禁忌或需谨慎的人群"
        items={drug.contraindications}
        icon={<UserRound size={17} />}
      />
      <InfoList
        title="使用注意事项"
        items={drug.precautions}
        icon={<TriangleAlert size={17} />}
        warning
      />
      <SourceLinks ids={drug.sourceIds} />
    </article>
  );
}

export function DrugLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = useMemo(
    () => ["全部", ...new Set(drugs.map((drug) => drug.category))],
    [],
  );
  const filtered = drugs.filter(
    (drug) =>
      (category === "全部" || drug.category === category) &&
      `${drug.name} ${drug.category} ${drug.purpose} ${drug.indications.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected = drugs.find((drug) => drug.id === selectedId);
  return (
    <section className="kv-page kv-drugs" aria-label="药物知识">
      <div className="kv-drug-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="搜索药品名称、类别或作用"
        />
        <span>{filtered.length} 条科普知识</span>
      </div>
      <div className="kv-filter-row kv-wide-filters" aria-label="药物分类">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={category === item}
            className={`kv-filter${category === item ? " kv-active" : ""}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="kv-medical-notice">
        <ShieldCheck size={18} />
        <p>
          药物知识帮助您与医生更好地沟通。请勿自行组合或长期使用药物，儿童、孕妇及有基础疾病者应先咨询医生或药师。
        </p>
      </div>
      <div className="kv-drug-grid">
        {filtered.map((drug, index) => (
          <button
            type="button"
            className="kv-drug-card"
            key={drug.id}
            onClick={() => setSelectedId(drug.id)}
          >
            <span className="kv-drug-card-top">
              <span className={`kv-pill-icon kv-pill-tone-${index % 3}`}>
                <Pill size={24} strokeWidth={1.6} />
              </span>
              <span className="kv-category-label">{drug.category}</span>
            </span>
            <strong>{drug.name}</strong>
            <p>{drug.purpose}</p>
            <span className="kv-drug-card-bottom">
              了解作用与注意事项
              <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="kv-empty kv-empty-wide">
          <Search size={28} />
          <strong>没有找到匹配的药物知识</strong>
          <p>试试药品名称或作用，例如“布洛芬”“退热”。</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("全部");
            }}
          >
            清除筛选
          </button>
        </div>
      )}
      <div className="kv-library-footnote">
        <BookOpen size={15} />
        依据公开健康资料整理 · 点击知识卡查看参考来源
      </div>
      {selected && (
        <Modal
          title="药物知识"
          eyebrow="MEDICATION GUIDE"
          onClose={() => setSelectedId(null)}
        >
          <DrugDetail drug={selected} />
        </Modal>
      )}
    </section>
  );
}

type EducationalReply = ReturnType<typeof generateEducationalReply>;
type ReplyMode = "local" | "online";
type ConversationTurn = {
  id: number;
  question: string;
  answer: EducationalReply;
  mode: ReplyMode;
  notice?: string;
};
const suggestedQuestions = [
  "最近右侧胸口偶尔疼是什么原因？",
  "咳嗽的时候需要观察什么？",
  "经常胃部反酸，平时怎么照护？",
  "如何在日常生活中保护心脏？",
];

function isEducationalReply(value: unknown): value is EducationalReply {
  if (!value || typeof value !== "object") return false;
  const answer = value as Record<string, unknown>;
  return (
    typeof answer.urgent === "boolean" &&
    Array.isArray(answer.sourceIds) &&
    answer.sourceIds.every((id) => typeof id === "string") &&
    Array.isArray(answer.sections) &&
    answer.sections.length === 4 &&
    answer.sections.every((section: unknown) => {
      if (!section || typeof section !== "object") return false;
      const item = section as Record<string, unknown>;
      return (
        typeof item.title === "string" &&
        Array.isArray(item.items) &&
        item.items.every((text: unknown) => typeof text === "string")
      );
    })
  );
}

export function HealthAssistant({
  initialQuestion,
}: {
  initialQuestion?: string;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [pending, setPending] = useState("");
  const [serviceMode, setServiceMode] = useState<ReplyMode | "checking">(
    "checking",
  );
  const [requestError, setRequestError] = useState<{
    question: string;
    message: string;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handledInitial = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 5000);
    let disposed = false;
    fetch("/api/health/status", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Status unavailable");
        const status = await response.json();
        if (!disposed)
          setServiceMode(status.mode === "online" ? "online" : "local");
      })
      .catch(() => {
        if (!disposed) setServiceMode("local");
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(deadline);
    };
  }, []);

  const cancelPending = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    requestController.current?.abort();
    requestController.current = null;
  };

  const submitQuestion = (value: string) => {
    const cleaned = value.trim().slice(0, 500);
    if (
      !cleaned ||
      timer.current ||
      requestController.current ||
      serviceMode === "checking"
    )
      return;
    const mode = serviceMode;
    const context = turns[turns.length - 1]?.question;
    setQuestion("");
    setRequestError(null);
    setPending(cleaned);
    if (mode === "local") {
      timer.current = setTimeout(() => {
        const isFollowup =
          /^(还有|那|那么|这些|上述|有哪些需要就医的危险信号|有什么需要注意)/.test(
            cleaned,
          );
        const localQuestion =
          context && isFollowup ? context + "。追问：" + cleaned : cleaned;
        const answer = generateEducationalReply(localQuestion);
        setTurns((previous) => [
          ...previous,
          { id: nextId.current++, question: cleaned, answer, mode: "local" },
        ]);
        setPending("");
        timer.current = null;
        inputRef.current?.focus({ preventScroll: true });
      }, 300);
      return;
    }
    const controller = new AbortController();
    requestController.current = controller;
    void (async () => {
      try {
        const response = await fetch("/api/health/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            question: cleaned,
            ...(context ? { context } : {}),
          }),
        });
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? "当前请求较多，请稍后重试。"
              : "在线 AI 服务暂时未能完成回答，请重试。",
          );
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object")
          throw new Error("服务返回了无法读取的回答，请重试。");
        const result = payload as Record<string, unknown>;
        if (
          (result.mode !== "online" && result.mode !== "local") ||
          !isEducationalReply(result.answer)
        ) {
          throw new Error("回答格式不完整，请重试。");
        }
        if (controller.signal.aborted) return;
        const answer = result.answer;
        const answerMode = result.mode;
        const notice =
          typeof result.notice === "string"
            ? result.notice
            : answerMode === "local"
              ? "本次回答来自本地科普资料。"
              : undefined;
        setTurns((previous) => [
          ...previous,
          {
            id: nextId.current++,
            question: cleaned,
            answer,
            mode: answerMode,
            notice,
          },
        ]);
      } catch (error) {
        if (!controller.signal.aborted) {
          const readableErrors = [
            "当前请求较多，请稍后重试。",
            "在线 AI 服务暂时未能完成回答，请重试。",
            "服务返回了无法读取的回答，请重试。",
            "回答格式不完整，请重试。",
          ];
          const message =
            error instanceof Error && readableErrors.includes(error.message)
              ? error.message
              : "无法连接在线 AI 服务，请检查网络后重试。";
          setRequestError({ question: cleaned, message });
        }
      } finally {
        if (requestController.current === controller) {
          requestController.current = null;
          setPending("");
          inputRef.current?.focus({ preventScroll: true });
        }
      }
    })();
  };

  useEffect(() => {
    if (
      serviceMode !== "checking" &&
      initialQuestion &&
      initialQuestion !== handledInitial.current
    ) {
      handledInitial.current = initialQuestion;
      submitQuestion(initialQuestion);
    }
  }, [initialQuestion, serviceMode]);
  useEffect(
    () => () => {
      cancelPending();
      handledInitial.current = "";
    },
    [],
  );
  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation && (turns.length || pending || requestError))
      conversation.scrollTo({
        top: conversation.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [turns, pending, requestError]);
  const lastAnswer = turns[turns.length - 1]?.answer;
  const busy = Boolean(pending) || serviceMode === "checking";
  const reset = () => {
    cancelPending();
    setTurns([]);
    setPending("");
    setQuestion("");
    setRequestError(null);
    inputRef.current?.focus();
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitQuestion(question);
  };

  return (
    <section className="kv-page kv-assistant-page" aria-label="健康知识助手">
      <div className="kv-assistant-shell">
        <header className="kv-assistant-header">
          <div className="kv-assistant-identity">
            <span className="kv-assistant-avatar">
              <Sparkles size={21} />
            </span>
            <div>
              <h2>健康知识助手</h2>
              <p>
                <span />
                {serviceMode === "online"
                  ? "在线 AI · 医学科普"
                  : serviceMode === "checking"
                    ? "正在确认服务状态…"
                    : "本地科普演示 · 未连接在线 AI"}
              </p>
            </div>
          </div>
          <button
            className="kv-reset-chat"
            type="button"
            disabled={!turns.length && !pending && !question && !requestError}
            onClick={reset}
          >
            <RotateCcw size={15} />
            重新开始
          </button>
        </header>
        <div className="kv-chat-notice">
          <Info size={15} />
          {serviceMode === "online"
            ? "提问将发送至已配置的 AI 服务；请勿填写姓名、联系方式等隐私信息。"
            : "回答来自本地知识与规则，仅供科普，不能诊断疾病或开具处方。"}
        </div>
        {lastAnswer?.urgent && (
          <div className="kv-urgent-banner" role="alert">
            <TriangleAlert size={21} />
            <div>
              <strong>请优先寻求专业医疗帮助</strong>
              <p>
                问题涉及需要紧急评估的危险信号。如症状正在发生，请立即拨打 120
                或当地急救电话。
              </p>
            </div>
          </div>
        )}
        <div
          className="kv-conversation"
          ref={conversationRef}
          role="log"
          aria-label="健康科普问答记录"
          aria-live="polite"
          aria-relevant="additions"
        >
          {!turns.length && !pending && !requestError && (
            <div className="kv-chat-welcome">
              <div className="kv-chat-orbit" aria-hidden="true">
                <span />
                <HeartPulse size={36} strokeWidth={1.4} />
                <i />
                <b />
              </div>
              <span className="kv-eyebrow">
                A LITTLE KNOWLEDGE, A HEALTHIER YOU
              </span>
              <h2>关于身体，你想了解什么？</h2>
              <p>
                从一个小问题开始，了解可能原因、观察要点、
                <br className="kv-desktop-break" />
                日常照护和需要就医的信号。
              </p>
              <div className="kv-question-grid">
                {suggestedQuestions.map((item, index) => (
                  <button
                    type="button"
                    key={item}
                    disabled={busy}
                    onClick={() => submitQuestion(item)}
                  >
                    <span>
                      {index === 0 ? (
                        <HeartPulse size={18} />
                      ) : index === 1 ? (
                        <Activity size={18} />
                      ) : index === 2 ? (
                        <Stethoscope size={18} />
                      ) : (
                        <ShieldCheck size={18} />
                      )}
                      {item}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="kv-welcome-note">
                <ShieldCheck size={13} />
                {serviceMode === "online"
                  ? "对话随页面刷新清除；问题会发送至配置的 AI 服务"
                  : "对话仅在当前页面内展示，刷新后清除"}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <div className="kv-conversation-turn" key={turn.id}>
              <div className="kv-user-message">
                <div>{turn.question}</div>
                <span aria-label="我的提问">
                  <UserRound size={17} />
                </span>
              </div>
              <article className="kv-answer-message">
                <span className="kv-answer-avatar" aria-hidden="true">
                  <Sparkles size={17} />
                </span>
                <div className="kv-answer-content">
                  <div className="kv-answer-label">
                    健康知识助手
                    <span>
                      {turn.mode === "online" ? "在线 AI" : "本地资料"}
                    </span>
                  </div>
                  {turn.notice && (
                    <p className="kv-answer-notice">{turn.notice}</p>
                  )}
                  {turn.answer.urgent && (
                    <div className="kv-answer-alert">
                      <TriangleAlert size={16} />
                      先关注危险信号，必要时立即寻求急救。
                    </div>
                  )}
                  <div className="kv-answer-sections">
                    {turn.answer.sections.map((section, index) => (
                      <section key={section.title}>
                        <h3>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          {section.title}
                        </h3>
                        <ul>
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                  <SourceLinks ids={turn.answer.sourceIds} />
                  <p className="kv-answer-disclaimer">
                    这些信息无法判断你的具体病因。如症状持续、加重或反复，建议就医评估。
                  </p>
                </div>
              </article>
            </div>
          ))}
          {pending && (
            <div className="kv-conversation-turn">
              <div className="kv-user-message">
                <div>{pending}</div>
                <span>
                  <UserRound size={17} />
                </span>
              </div>
              <div className="kv-chat-loading">
                <Sparkles size={17} />
                <span>
                  {serviceMode === "online"
                    ? "正在等待在线 AI 整理科普回答"
                    : "正在整理本地科普资料"}
                </span>
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          {requestError && (
            <div className="kv-conversation-turn">
              <div className="kv-user-message">
                <div>{requestError.question}</div>
                <span>
                  <UserRound size={17} />
                </span>
              </div>
              <div className="kv-request-error" role="alert">
                <TriangleAlert size={17} />
                <div>
                  <strong>在线回答未完成</strong>
                  <p>{requestError.message}</p>
                  <button
                    type="button"
                    onClick={() => submitQuestion(requestError.question)}
                    disabled={busy}
                  >
                    <RotateCcw size={13} />
                    重试这个问题
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="kv-composer-area">
          {turns.length > 0 && !pending && (
            <div className="kv-followups">
              <span>继续了解</span>
              {["有哪些需要就医的危险信号？", "日常如何保护心脏？"].map(
                (item) => (
                  <button
                    type="button"
                    key={item}
                    disabled={busy}
                    onClick={() => submitQuestion(item)}
                  >
                    {item}
                    <ChevronRight size={12} />
                  </button>
                ),
              )}
            </div>
          )}
          <form className="kv-composer" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              value={question}
              disabled={busy}
              rows={2}
              maxLength={500}
              aria-label="输入健康科普问题"
              placeholder={
                serviceMode === "checking"
                  ? "正在准备健康知识助手…"
                  : "输入你想了解的健康问题…"
              }
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submitQuestion(question);
                }
              }}
            />
            <div className="kv-composer-bottom">
              <span>
                {question.length > 0
                  ? question.length + " / 500"
                  : "Enter 发送 · Shift + Enter 换行"}
              </span>
              <button
                type="submit"
                aria-label="发送问题"
                disabled={!question.trim() || busy}
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          <p className="kv-composer-footnote">
            不提供诊断、处方或剂量建议 · 紧急情况请立即联系急救服务
          </p>
        </div>
      </div>
      <aside className="kv-assistant-aside">
        <span className="kv-eyebrow">BETTER QUESTIONS</span>
        <h2>
          了解健康，
          <br />
          从细节开始。
        </h2>
        <p>描述得更清楚，有助于你与专业医生有效沟通。</p>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>发生在哪里</strong>
              <p>身体的具体部位，是否向其他位置放射。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>持续了多久</strong>
              <p>何时开始、频率，以及是否逐渐加重。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>还伴随什么</strong>
              <p>例如发热、出汗、呼吸变化等其他表现。</p>
            </div>
          </li>
        </ol>
        <div className="kv-aside-emergency">
          <HeartPulse size={23} />
          <strong>紧急情况，请先求助</strong>
          <p>严重胸痛、呼吸困难、意识异常等情况，应立即联系急救服务。</p>
          <span>
            中国大陆急救电话 <b>120</b>
          </span>
        </div>
        <div className="kv-aside-source">
          <BookOpen size={16} />
          <span>
            科普信息供学习参考
            <br />
            具体诊疗请咨询医生
          </span>
        </div>
      </aside>
    </section>
  );
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current
      ?.querySelector<HTMLButtonElement>(".kv-modal-close")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...(dialogRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
          ) || []),
        ].filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialogRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="kv-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`kv-modal${wide ? " kv-modal-wide" : ""}`}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="kv-modal-header">
          <div>
            <span className="kv-eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="kv-modal-close kv-icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="kv-modal-content">{children}</div>
        <footer className="kv-modal-footer">
          <ShieldCheck size={15} />
          <span>用于医学科普学习，不替代医生诊断和治疗。</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function SourceDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="内容来源与使用说明"
      eyebrow="KNOWLEDGE & CREDITS"
      onClose={onClose}
      wide
    >
      <p className="kv-modal-lead">让每一份知识，都有据可查。</p>
      <p className="kv-small-copy">
        医学科普内容参考以下公开健康资料，经简化与中文整理用于大众理解。页面中的症状、照护和药物信息不构成个体诊疗建议。
      </p>
      <div className="kv-source-directory">
        {sources.map((source, index) => (
          <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
            <span className="kv-source-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{source.title}</strong>
              <small>{source.organization}</small>
            </span>
            <ExternalLink size={16} />
            <span className="kv-sr-only">在新窗口打开</span>
          </a>
        ))}
      </div>
      <section className="kv-attribution">
        <h3>
          <Layers3 size={18} />
          3D 模型说明
        </h3>
        <p>
          模型用于理解器官的相对位置与人体系统关系。显示效果受模型资产、分层方式和浏览器性能影响；细节与个体真实解剖存在差异，不用于临床测量、术前规划或诊断。
        </p>
        <p>
          器官与骨骼网格来自 Z-Anatomy，由 Gauthier Kervyn
          等贡献者制作；皮肤来自 DBCLS 的
          BodyParts3D。模型经过子集提取、配色与近似配准，临床解剖精度未经专业验证。当前使用中性科普外观：弱化皮肤表面的性别特征，隐藏生殖相关结构，保留肾脏、输尿管、膀胱与骨盆；不用于生殖解剖教学。
        </p>
        <div className="kv-sources">
          <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
            模型来源、完整署名与许可
            <ExternalLink size={11} />
          </a>
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            Z-Anatomy · CC BY-SA 4.0
            <ExternalLink size={11} />
          </a>
          <a
            href="https://creativecommons.org/licenses/by-sa/2.1/jp/"
            target="_blank"
            rel="noreferrer"
          >
            BodyParts3D · CC BY-SA 2.1 JP
            <ExternalLink size={11} />
          </a>
        </div>
      </section>
      <section className="kv-attribution">
        <h3>
          <Sparkles size={18} />
          问答功能说明
        </h3>
        <p>
          健康知识助手默认通过本地知识与规则提供科普回复；配置服务端 AI
          后可使用在线问答。界面会明确显示当前模式，在线提问会发送至已配置的 AI
          服务。它无法检查身体或确定病因，也不会开具处方或提供剂量。
        </p>
      </section>
    </Modal>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: <MousePointer2 size={23} />,
      title: "旋转与查看",
      copy: "在人体模型区域按住鼠标左键拖动，即可从不同角度观察。触屏设备可用单指拖动。",
    },
    {
      icon: <ZoomIn size={23} />,
      title: "拉近细节",
      copy: "在全身、上半身和器官聚焦之间切换；滚轮或双指可缩放。选择“解剖细节”观察表面起伏，或切换“柔和展示”。",
    },
    {
      icon: <Layers3 size={23} />,
      title: "探索人体层次",
      copy: "通过系统分类与显示控制切换可见结构，选择器官名称或点击模型，阅读对应知识卡。",
    },
    {
      icon: <MessageCircle size={23} />,
      title: "从疑问开始",
      copy: "进入症状探索了解可能涉及的区域，再查看疾病、药物科普或向健康知识助手提问。",
    },
  ];
  return (
    <Modal
      title="开始你的身体探索"
      eyebrow="A QUICK GUIDE"
      onClose={onClose}
      wide
    >
      <p className="kv-modal-lead">像探索地图一样，认识自己的身体。</p>
      <div className="kv-help-grid">
        {steps.map((step, index) => (
          <section key={step.title}>
            <div className="kv-help-step">
              <span>{step.icon}</span>
              <small>0{index + 1}</small>
            </div>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
          </section>
        ))}
      </div>
      <div className="kv-keyboard-help">
        <CircleHelp size={18} />
        <div>
          <h3>键盘操作</h3>
          <p>
            使用 <kbd>Tab</kbd> 切换按钮、器官列表与输入框，<kbd>Enter</kbd> 或{" "}
            <kbd>Space</kbd> 操作按钮，<kbd>Esc</kbd> 关闭弹窗。无需直接操作 3D
            画布，也可通过器官列表阅读知识。
          </p>
        </div>
      </div>
      <div className="kv-medical-notice">
        <TriangleAlert size={18} />
        <p>
          3D
          模型和症状标记用于科普理解，不代表个人身体状态。严重或持续的不适应及时就医；发生紧急情况时请拨打
          120 或当地急救电话。
        </p>
      </div>
    </Modal>
  );
}
