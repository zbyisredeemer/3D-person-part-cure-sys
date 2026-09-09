import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bone,
  BookOpen,
  Bookmark,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Cross,
  Droplet,
  Expand,
  Eye,
  EyeOff,
  Focus,
  Heart,
  Info,
  Layers3,
  Leaf,
  LoaderCircle,
  Menu,
  MessageCircle,
  Minus,
  MousePointer2,
  Move,
  PersonStanding,
  Pill,
  Plus,
  RotateCcw,
  RotateCw,
  ScanLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Wind,
  X,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { organs, systems, scenarios, diseases } from "./data/medical";
import type { Organ } from "./data/medical";
import { evaluateRisk } from "./lib/health";
import {
  DiseaseLibrary,
  DrugLibrary,
  HealthAssistant,
  HelpDialog,
  SourceDialog,
} from "./components/KnowledgeViews";
import { HumanMark, LungArt } from "./components/OrganArt";

const AnatomyScene = lazy(() => import("./components/AnatomyScene"));
type Page = "explore" | "symptoms" | "diseases" | "drugs" | "assistant";
type View = "front" | "back" | "left" | "right";
const navItems: { id: Page; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "人体探索", icon: Compass },
  { id: "symptoms", label: "症状模拟", icon: Activity },
  { id: "diseases", label: "疾病百科", icon: BookOpen },
  { id: "drugs", label: "药物知识", icon: Pill },
  { id: "assistant", label: "AI 健康助手", icon: Sparkles },
];
const systemIcons: Record<string, typeof Heart> = {
  nervous: Brain,
  respiratory: Wind,
  circulatory: Heart,
  digestive: Leaf,
  urinary: Droplet,
  skeletal: Bone,
  muscular: PersonStanding,
};
const flagOptions = [
  { id: "chest-pain", label: "胸痛" },
  { id: "dyspnea", label: "呼吸困难" },
  { id: "cold-sweat", label: "出冷汗" },
  { id: "fever", label: "发热" },
  { id: "cough", label: "咳嗽" },
  { id: "dizziness", label: "头晕" },
  { id: "severe-pain", label: "剧烈或持续疼痛" },
  { id: "radiating-pain", label: "疼痛向肩臂放射" },
];

class SceneErrorBoundary extends Component<
  { children: ReactNode; resetKey: number },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("Anatomy renderer:", error);
  }
  componentDidUpdate(prev: { resetKey: number }) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError)
      this.setState({ hasError: false });
  }
  render() {
    return this.state.hasError ? (
      <div className="scene-error">
        <ScanLine size={38} />
        <strong>3D 场景暂时无法显示</strong>
        <p>
          请检查网络和浏览器的 WebGL 支持。你仍可使用左侧目录探索全部器官知识。
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function IconButton({
  children,
  label,
  onClick,
  active,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function OrganPanel({
  organ,
  onSymptom,
  onDisease,
  onAsk,
  bookmarked,
  onBookmark,
  onSources,
}: {
  organ: Organ;
  onSymptom: () => void;
  onDisease: (name: string) => void;
  onAsk: (q: string) => void;
  bookmarked: boolean;
  onBookmark: () => void;
  onSources: () => void;
}) {
  const [tab, setTab] = useState("overview");
  useEffect(() => setTab("overview"), [organ.id]);
  const system = systems.find((s) => s.id === organ.system);
  const SysIcon = systemIcons[organ.system] || Activity;
  return (
    <aside className="organ-panel" aria-label="器官知识档案">
      <div className="panel-eyebrow">
        <span>
          <BookOpen size={14} /> 器官档案
        </span>
        <IconButton
          label={bookmarked ? "取消收藏" : "收藏此器官"}
          onClick={onBookmark}
          active={bookmarked}
        >
          <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
        </IconButton>
      </div>
      <div className="organ-title-row">
        <div>
          <span
            className="system-tag"
            style={
              {
                "--tag-color": system?.color || "#579993",
              } as React.CSSProperties
            }
          >
            <i />
            {system?.name || "人体结构"}
          </span>
          <h2>
            {organ.name.replace(/部$/, "")}
            <span>{organ.english}</span>
          </h2>
        </div>
        <div className="organ-art">
          {organ.id === "lungs" ? (
            <LungArt />
          ) : (
            <SysIcon size={48} strokeWidth={1.2} />
          )}
        </div>
      </div>
      <div className="panel-tabs" role="tablist" aria-label="器官知识分类">
        {[
          { id: "overview", label: "器官概览" },
          { id: "conditions", label: "常见问题" },
          { id: "care", label: "日常养护" },
        ].map((t) => (
          <button
            key={t.id}
            id={`organ-tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="organ-tab-content"
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const ids = ["overview", "conditions", "care"];
                const next =
                  ids[
                    (ids.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3
                  ];
                setTab(next);
                document.getElementById(`organ-tab-${next}`)?.focus();
              }
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="organ-panel-body"
        id="organ-tab-content"
        role="tabpanel"
        aria-labelledby={`organ-tab-${tab}`}
      >
        {tab === "overview" && (
          <>
            <p className="organ-summary">{organ.summary}</p>
            <div className="anatomy-fact">
              <span className="fact-icon">
                <Activity size={19} />
              </span>
              <div>
                <strong>{organ.fact.value}</strong>
                <span>{organ.fact.label}</span>
              </div>
              <span className="fact-decoration">+</span>
            </div>
            <h3 className="section-label">
              <CircleDot size={15} />
              主要功能
            </h3>
            <div className="function-list">
              {organ.functions.map((f, i) => (
                <div key={f}>
                  <span>0{i + 1}</span>
                  <p>{f}</p>
                </div>
              ))}
            </div>
            <h3 className="section-label">
              <ShieldCheck size={15} />
              正常状态
            </h3>
            <p className="small-copy">{organ.normal}</p>
            <h3 className="section-label condition-heading">
              常见相关疾病{" "}
              <button onClick={() => setTab("conditions")}>
                查看全部
                <ChevronRight size={13} />
              </button>
            </h3>
            <div className="condition-chips">
              {organ.diseases.slice(0, 4).map((d) =>
                diseases.some((item) => item.name === d) ? (
                  <button key={d} onClick={() => onDisease(d)}>
                    {d}
                    <ChevronRight size={11} />
                  </button>
                ) : (
                  <span key={d}>{d}</span>
                ),
              )}
            </div>
          </>
        )}
        {tab === "conditions" && (
          <>
            <h3 className="section-label">常见相关疾病</h3>
            <div className="condition-chips large">
              {organ.diseases.map((d) =>
                diseases.some((item) => item.name === d) ? (
                  <button key={d} onClick={() => onDisease(d)}>
                    {d}
                    <ArrowUpRight size={13} />
                  </button>
                ) : (
                  <span key={d}>{d}</span>
                ),
              )}
            </div>
            <h3 className="section-label">
              <Activity size={15} />
              可能的异常症状
            </h3>
            <ul className="knowledge-list">
              {organ.symptoms.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <h3 className="section-label">
              <AlertTriangle size={15} />
              需要留意的风险因素
            </h3>
            <ul className="knowledge-list">
              {organ.risks.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="inline-note">
              <Info size={16} />
              <span>症状可能有多种原因，仅凭症状无法确定疾病。</span>
            </div>
          </>
        )}
        {tab === "care" && (
          <>
            <div className="care-intro">
              <Leaf size={24} />
              <div>
                <h3>把健康融入每一天</h3>
                <p>从可坚持的小习惯开始。</p>
              </div>
            </div>
            <ul className="care-list">
              {organ.care.map((s, i) => (
                <li key={s}>
                  <span>{i + 1}</span>
                  <p>{s}</p>
                </li>
              ))}
            </ul>
            <button
              className="ask-organ-button"
              onClick={() => onAsk(`如何在日常生活中保护${organ.name}？`)}
            >
              <MessageCircle size={16} />
              向健康助手了解更多
              <ArrowRight size={15} />
            </button>
          </>
        )}
        <button className="source-link" onClick={onSources}>
          <BadgeCheck size={13} />
          查看医学参考来源
          <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="organ-panel-bottom">
        <div className="medical-note">
          <ShieldCheck size={14} />
          <span>了解知识是第一步，专业诊疗不可替代。</span>
        </div>
        <button className="primary-button" onClick={onSymptom}>
          <Activity size={16} />
          探索相关症状
          <ArrowRight size={16} />
        </button>
      </div>
    </aside>
  );
}

function SymptomPanel({
  scenarioId,
  flags,
  onFlags,
  onAsk,
  onSources,
}: {
  scenarioId: string;
  flags: string[];
  onFlags: (flags: string[]) => void;
  onAsk: (q: string) => void;
  onSources: () => void;
}) {
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
  const risk = evaluateRisk(flags);
  return (
    <aside className="organ-panel symptom-panel">
      <div className="panel-eyebrow">
        <span>
          <Activity size={14} />
          症状观察
        </span>
        <span className="small-label">学习演示</span>
      </div>
      <h2 className="symptom-title">
        {scenario.name}
        <span>{scenario.region}</span>
      </h2>
      <p className="small-copy">
        选择同时出现的表现，了解何时需要寻求专业帮助。
      </p>
      <div className="flag-grid">
        {flagOptions.map((f) => (
          <button
            key={f.id}
            className={flags.includes(f.id) ? "selected" : ""}
            aria-pressed={flags.includes(f.id)}
            onClick={() =>
              onFlags(
                flags.includes(f.id)
                  ? flags.filter((v) => v !== f.id)
                  : [...flags, f.id],
              )
            }
          >
            <span className="flag-check">
              {flags.includes(f.id) && <Check size={10} />}
            </span>
            {f.label}
          </button>
        ))}
      </div>
      <div className={`risk-card risk-${risk.level}`} role="status">
        <div>
          {risk.level === "red" ? (
            <AlertTriangle size={20} />
          ) : risk.level === "yellow" ? (
            <Info size={20} />
          ) : (
            <ShieldCheck size={20} />
          )}
          <strong>{risk.title}</strong>
        </div>
        <p>{risk.message}</p>
        {risk.actions.map((action) => (
          <p className="risk-action" key={action}>
            {action}
          </p>
        ))}
      </div>
      <div className="organ-panel-body">
        <h3 className="section-label">
          <CircleDot size={15} />
          常见可能原因
        </h3>
        <ul className="knowledge-list">
          {scenario.common.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3 className="section-label">
          <Info size={15} />
          需要关注
        </h3>
        <ul className="knowledge-list">
          {scenario.attention.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3 className="section-label danger">
          <AlertTriangle size={15} />
          危险信号
        </h3>
        <ul className="knowledge-list danger-list">
          {scenario.redFlags.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3 className="section-label">
          <Leaf size={15} />
          基础自我照护
        </h3>
        <ul className="knowledge-list">
          {scenario.care.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <button className="source-link" onClick={onSources}>
          <BadgeCheck size={13} />
          查看医学参考来源
          <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="organ-panel-bottom">
        <button
          className="primary-button"
          onClick={() =>
            onAsk(`${scenario.name}可能有哪些原因？有哪些需要就医的危险信号？`)
          }
        >
          <MessageCircle size={16} />
          进一步了解这个症状
          <ArrowRight size={16} />
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("explore");
  const [selectedOrgan, setSelectedOrgan] = useState("lungs");
  const [activeSystem, setActiveSystem] = useState("all");
  const [expandedSystem, setExpandedSystem] = useState<string | null>(
    "respiratory",
  );
  const [search, setSearch] = useState("");
  const [skinOpacity, setSkinOpacity] = useState(0.28);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    skin: true,
    organs: true,
    skeleton: true,
    vessels: false,
    nerves: false,
    muscles: false,
  });
  const [autoRotate, setAutoRotate] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [bodyFraming, setBodyFraming] = useState<"full" | "upper">("upper");
  const [renderStyle, setRenderStyle] = useState<"detailed" | "soft">(
    "detailed",
  );
  const [showLabels, setShowLabels] = useState(true);
  const [view, setView] = useState<View>("front");
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneExpanded, setSceneExpanded] = useState(false);
  const [scenarioId, setScenarioId] = useState("chest-pain");
  const [flags, setFlags] = useState<string[]>(["chest-pain"]);
  const [modal, setModal] = useState<"help" | "sources" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialDisease, setInitialDisease] = useState("");
  const [question, setQuestion] = useState("");
  const [toast, setToast] = useState("");
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("atlas-bookmarks") || "[]");
      return Array.isArray(saved)
        ? saved.filter((x: unknown) => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const organ = organs.find((o) => o.id === selectedOrgan) || organs[0];
  const filteredOrgans = organs.filter(
    (o) =>
      `${o.name} ${o.english} ${systems.find((s) => s.id === o.system)?.name} ${systems.find((s) => s.id === o.system)?.english}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!onlyBookmarks || bookmarks.includes(o.id)),
  );
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
  useEffect(() => {
    try {
      localStorage.setItem("atlas-bookmarks", JSON.stringify(bookmarks));
    } catch {
      /* The interface remains usable if storage is unavailable. */
    }
  }, [bookmarks]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSceneExpanded(false);
        setSidebarOpen(false);
      }
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setPage("explore");
        setSidebarOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
    setSceneExpanded(false);
  };
  const activateSystem = (id: string, keepSelection = false) => {
    setActiveSystem(id);
    if (!keepSelection) {
      const first = organs.find((o) => o.system === id);
      if (first) setSelectedOrgan(first.id);
    }
    const layer = (
      {
        skeletal: "skeleton",
        muscular: "muscles",
        circulatory: "vessels",
        nervous: "nerves",
      } as Record<string, string>
    )[id];
    if (layer) setLayers((prev) => ({ ...prev, [layer]: true }));
    else if (id !== "all") setLayers((prev) => ({ ...prev, organs: true }));
  };
  const selectOrgan = (id: string) => {
    setSelectedOrgan(id);
    ensureSelectedLayer(id);
    setSidebarOpen(false);
    const next = organs.find((o) => o.id === id);
    if (next) {
      setExpandedSystem(next.system);
      if (activeSystem !== "all" && activeSystem !== next.system)
        activateSystem(next.system, true);
    }
  };
  const showDisease = (name: string) => {
    setInitialDisease(name);
    navigate("diseases");
  };
  const ask = (q: string) => {
    setQuestion(q);
    navigate("assistant");
  };
  const ensureSelectedLayer = (organId = selectedOrgan) => {
    const layer =
      (
        {
          bones: "skeleton",
          muscles: "muscles",
          vessels: "vessels",
          nerves: "nerves",
        } as Record<string, string>
      )[organId] || "organs";
    setLayers((previous) => ({ ...previous, [layer]: true }));
  };
  const resetScene = () => {
    setZoom(1);
    setView("front");
    setFocusMode(false);
    setAutoRotate(false);
    setResetKey((k) => k + 1);
  };
  const selectScenario = (id: string) => {
    setScenarioId(id);
    const next = scenarios.find((s) => s.id === id);
    if (next?.organIds[0]) setSelectedOrgan(next.organIds[0]);
    setFlags(
      id === "chest-pain" ? ["chest-pain"] : id === "cough" ? ["cough"] : [],
    );
    setSidebarOpen(false);
  };
  const relatedSymptoms = () => {
    const related = scenarios.find((s) => s.organIds.includes(selectedOrgan));
    selectScenario(related?.id || "chest-pain");
    navigate("symptoms");
  };
  const toggleLayer = (id: string) =>
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleBookmark = () => {
    const has = bookmarks.includes(selectedOrgan);
    setBookmarks((prev) =>
      has ? prev.filter((b) => b !== selectedOrgan) : [...prev, selectedOrgan],
    );
    setToast(has ? "已取消收藏" : "已收藏，可在器官目录中查看");
  };

  return (
    <div className="atlas-app">
      <a href="#main-content" className="skip-link">
        跳转到主要内容
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => navigate("explore")}
          aria-label="知体 Atlas 首页"
        >
          <span className="brand-symbol">
            <Cross size={24} strokeWidth={2.3} />
            <i />
          </span>
          <span className="brand-name">
            知体<span>ATLAS</span>
          </span>
          <span className="brand-divider" />
          <span className="brand-description">看见身体的奥秘</span>
        </button>
        <nav className="main-nav" aria-label="主导航">
          {navItems.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
                aria-current={page === n.id ? "page" : undefined}
              >
                <Icon size={16} />
                <span>{n.label}</span>
                {n.id === "assistant" && <span className="ai-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="header-actions">
          <button
            className="guide-button"
            aria-label="使用指南"
            onClick={() => setModal("help")}
          >
            <CircleHelp size={16} />
            <span>使用指南</span>
          </button>
          <span className="header-separator" />
          <button
            className="avatar"
            aria-label="查看收藏的器官"
            title="我的收藏"
            onClick={() => {
              navigate("explore");
              setOnlyBookmarks((v) => !v);
              setSidebarOpen(true);
            }}
          >
            <Bookmark size={17} />
            {bookmarks.length > 0 && <i>{bookmarks.length}</i>}
          </button>
        </div>
      </header>
      <main id="main-content" className="main-content">
        <section className="page-intro">
          <div className="intro-title">
            <span className="intro-eyebrow">
              {page === "explore"
                ? "THE HUMAN BODY, DISCOVERED"
                : page === "symptoms"
                  ? "LISTEN TO YOUR BODY"
                  : page === "diseases"
                    ? "UNDERSTAND YOUR HEALTH"
                    : page === "drugs"
                      ? "KNOW YOUR MEDICINE"
                      : "YOUR HEALTH, EXPLAINED"}
            </span>
            <h1>
              {page === "explore"
                ? "探索身体，理解健康"
                : page === "symptoms"
                  ? "倾听身体发出的信号"
                  : page === "diseases"
                    ? "多一点了解，少一点担心"
                    : page === "drugs"
                      ? "认识药物，安全用药"
                      : "关于健康，慢慢说清楚"}
              <span className="title-dot">.</span>
            </h1>
            <p>
              {page === "explore"
                ? "从一次点击开始，开启你的人体探索之旅。"
                : page === "symptoms"
                  ? "观察症状与相关器官，学习识别需要关注的健康信号。"
                  : page === "diseases"
                    ? "了解常见疾病、基础照护和需要就医的时机。"
                    : page === "drugs"
                      ? "了解药物作用、常见副作用与使用注意事项。"
                      : "了解可能的原因、观察重点和就医时机。"}
            </p>
          </div>
          <button
            className="evidence-badge"
            onClick={() => setModal("sources")}
          >
            <span>
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>有依据的医学科普</strong>
              <small>参考权威健康知识来源</small>
            </div>
            <ArrowUpRight size={14} />
          </button>
        </section>
        {page === "explore" || page === "symptoms" ? (
          <>
            <div
              className={`exploration-workspace ${sceneExpanded ? "expanded-workspace" : ""}`}
            >
              <aside
                className={`anatomy-sidebar ${sidebarOpen ? "mobile-open" : ""}`}
                aria-label={
                  page === "explore" ? "人体系统与器官目录" : "症状选择"
                }
              >
                <div className="sidebar-heading">
                  <h2>{page === "explore" ? "身体导航" : "选择一个症状"}</h2>
                  <span>
                    {page === "explore" ? "BODY SYSTEMS" : "SYMPTOMS"}
                  </span>
                  <button
                    className="mobile-close"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="关闭器官目录"
                  >
                    <X size={18} />
                  </button>
                </div>
                {page === "explore" ? (
                  <>
                    <label className="organ-search">
                      <Search size={15} />
                      <input
                        ref={searchRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="搜索器官、系统…"
                        aria-label="搜索器官"
                      />
                      {search ? (
                        <button
                          onClick={() => setSearch("")}
                          aria-label="清空搜索"
                        >
                          <X size={12} />
                        </button>
                      ) : (
                        <kbd>/</kbd>
                      )}
                    </label>
                    <div className="sidebar-filter">
                      <button
                        className={!onlyBookmarks ? "selected" : ""}
                        onClick={() => setOnlyBookmarks(false)}
                      >
                        全部结构
                      </button>
                      <button
                        className={onlyBookmarks ? "selected" : ""}
                        onClick={() => setOnlyBookmarks(true)}
                      >
                        <Bookmark size={11} />
                        我的收藏
                        {bookmarks.length > 0 && (
                          <span>{bookmarks.length}</span>
                        )}
                      </button>
                    </div>
                    <div className="systems-scroll">
                      {search || onlyBookmarks ? (
                        <div className="search-results">
                          <span className="result-count">
                            {filteredOrgans.length} 个
                            {onlyBookmarks ? "收藏" : "搜索结果"}
                          </span>
                          {filteredOrgans.map((o) => (
                            <button
                              key={o.id}
                              className={`organ-nav-item ${selectedOrgan === o.id ? "selected" : ""}`}
                              onClick={() => selectOrgan(o.id)}
                            >
                              <span className="organ-node" />
                              {o.name}
                              <ChevronRight size={12} />
                            </button>
                          ))}
                          {!filteredOrgans.length && (
                            <div className="sidebar-empty">
                              <Search size={24} />
                              <p>
                                {onlyBookmarks
                                  ? "还没有收藏的器官"
                                  : "暂未找到相关器官"}
                              </p>
                              <small>
                                {onlyBookmarks
                                  ? "点击器官档案右上角的书签保存。"
                                  : "试试“肺”“心脏”或英文名称。"}
                              </small>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <button
                            className={`system-row all-system ${activeSystem === "all" ? "selected" : ""}`}
                            onClick={() => {
                              setActiveSystem("all");
                              setExpandedSystem(null);
                            }}
                          >
                            <span className="system-icon">
                              <PersonStanding size={20} />
                            </span>
                            <div>
                              <strong>完整人体</strong>
                              <small>Full body</small>
                            </div>
                            <span className="system-count">
                              {organs.length}
                            </span>
                          </button>
                          <div className="sidebar-rule">
                            <span>人体系统</span>
                            <span>7 SYSTEMS</span>
                          </div>
                          {systems.map((s) => {
                            const Icon = systemIcons[s.id] || Activity;
                            const expanded = expandedSystem === s.id;
                            return (
                              <div
                                key={s.id}
                                className={`system-group ${expanded ? "expanded" : ""}`}
                              >
                                <button
                                  className={`system-row ${activeSystem === s.id ? "selected" : ""}`}
                                  onClick={() => {
                                    activateSystem(s.id);
                                    setExpandedSystem(expanded ? null : s.id);
                                  }}
                                  aria-expanded={expanded}
                                  style={
                                    {
                                      "--system-color": s.color,
                                    } as React.CSSProperties
                                  }
                                >
                                  <span className="system-icon">
                                    <Icon size={19} />
                                  </span>
                                  <div>
                                    <strong>{s.name}</strong>
                                    <small>{s.english}</small>
                                  </div>
                                  <ChevronDown
                                    className={expanded ? "rotated" : ""}
                                    size={13}
                                  />
                                </button>
                                {expanded && (
                                  <div className="system-organs">
                                    {organs
                                      .filter((o) => o.system === s.id)
                                      .map((o) => (
                                        <button
                                          key={o.id}
                                          className={`organ-nav-item ${selectedOrgan === o.id ? "selected" : ""}`}
                                          onClick={() => selectOrgan(o.id)}
                                        >
                                          <span className="organ-node" />
                                          {o.name}
                                          {selectedOrgan === o.id && (
                                            <span className="selected-organ-dot" />
                                          )}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    <div className="sidebar-bottom">
                      <div className="tiny-body">
                        <HumanMark />
                      </div>
                      <div>
                        <strong>一个身体，无限奥秘</strong>
                        <p>{organs.length} 个结构 · 7 大系统</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="symptom-sidebar-intro">
                      <Activity size={19} />
                      <p>选择症状，在人体上查看可能涉及的区域。</p>
                    </div>
                    <div className="symptom-options">
                      {scenarios.map((s, i) => (
                        <button
                          className={scenarioId === s.id ? "selected" : ""}
                          key={s.id}
                          onClick={() => selectScenario(s.id)}
                        >
                          <span className="symptom-number">0{i + 1}</span>
                          <div>
                            <strong>{s.name}</strong>
                            <small>{s.region}</small>
                          </div>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                    <div className="symptom-sidebar-warning">
                      <Info size={16} />
                      <p>
                        同一种症状可能涉及多个器官。动画用于理解位置，不能用于确定病因。
                      </p>
                    </div>
                  </>
                )}
              </aside>
              {sidebarOpen && (
                <button
                  className="sidebar-backdrop"
                  aria-label="关闭目录"
                  onClick={() => setSidebarOpen(false)}
                />
              )}
              <section
                ref={stageRef}
                className={`anatomy-stage ${page === "symptoms" ? "symptom-stage" : ""} ${focusMode || bodyFraming === "upper" ? "detail-framing" : ""}`}
                aria-label="交互式三维人体模型"
              >
                <div className="stage-top">
                  <div className="stage-breadcrumb">
                    <button
                      className="mobile-menu"
                      onClick={() => setSidebarOpen(true)}
                      aria-label="打开器官目录"
                    >
                      <Menu size={18} />
                    </button>
                    <span>
                      <ScanLine size={15} />
                      {page === "explore" ? "人体解剖图谱" : "症状区域演示"}
                    </span>
                    <ChevronRight size={12} />
                    <span>
                      {page === "explore"
                        ? systems.find((s) => s.id === activeSystem)?.name ||
                          "完整人体"
                        : scenario.name}
                    </span>
                  </div>
                  <span className="live-indicator">
                    <i />
                    实时 3D
                  </span>
                </div>
                <div className="stage-mode">
                  <button
                    className={
                      !focusMode && bodyFraming === "full" ? "selected" : ""
                    }
                    aria-pressed={!focusMode && bodyFraming === "full"}
                    onClick={() => {
                      setFocusMode(false);
                      setBodyFraming("full");
                      setZoom(1);
                    }}
                  >
                    <PersonStanding size={14} />
                    全身视图
                  </button>
                  <button
                    className={
                      !focusMode && bodyFraming === "upper" ? "selected" : ""
                    }
                    aria-pressed={!focusMode && bodyFraming === "upper"}
                    onClick={() => {
                      setFocusMode(false);
                      setBodyFraming("upper");
                      setZoom(1);
                    }}
                  >
                    <ScanLine size={14} />
                    上半身
                  </button>
                  <button
                    className={focusMode ? "selected" : ""}
                    aria-pressed={focusMode}
                    onClick={() => {
                      ensureSelectedLayer();
                      setFocusMode(true);
                      setZoom(1);
                    }}
                  >
                    <Focus size={14} />
                    器官聚焦
                  </button>
                </div>
                <div className="model-presentation">
                  <span
                    className="neutral-model-badge"
                    title="保留人体结构，简化体表性别特征；不用于生殖系统教学。"
                  >
                    <ShieldCheck size={12} />
                    中性科普外观
                  </span>
                  <div
                    className="render-style-switch"
                    role="group"
                    aria-label="模型显示风格"
                  >
                    <button
                      aria-pressed={renderStyle === "detailed"}
                      onClick={() => setRenderStyle("detailed")}
                    >
                      解剖细节
                    </button>
                    <button
                      aria-pressed={renderStyle === "soft"}
                      onClick={() => setRenderStyle("soft")}
                    >
                      柔和展示
                    </button>
                  </div>
                </div>
                <div className="model-frame">
                  <SceneErrorBoundary resetKey={resetKey}>
                    <Suspense
                      fallback={
                        <div className="scene-loading">
                          <LoaderCircle size={24} className="spin" />
                          <span>正在准备人体模型</span>
                        </div>
                      }
                    >
                      <AnatomyScene
                        selectedOrgan={selectedOrgan}
                        onSelectOrgan={selectOrgan}
                        activeSystem={
                          page === "symptoms" ? "all" : activeSystem
                        }
                        skinOpacity={skinOpacity}
                        layers={layers}
                        autoRotate={autoRotate}
                        zoom={zoom}
                        resetKey={resetKey}
                        focusMode={focusMode}
                        bodyFraming={bodyFraming}
                        renderStyle={renderStyle}
                        symptom={page === "symptoms" ? scenarioId : null}
                        showLabels={showLabels}
                        view={view}
                        onReady={() => setSceneReady(true)}
                      />
                    </Suspense>
                  </SceneErrorBoundary>
                </div>
                <div className="stage-axis-label">
                  <span>SUPERIOR</span>
                  <ArrowUpRight size={12} />
                </div>
                <div className="scene-toolbar">
                  <IconButton
                    label="放大模型"
                    onClick={() => setZoom((v) => Math.min(2.1, v + 0.15))}
                    disabled={zoom >= 2.1}
                  >
                    <Plus size={18} />
                  </IconButton>
                  <IconButton
                    label="缩小模型"
                    onClick={() => setZoom((v) => Math.max(0.65, v - 0.15))}
                    disabled={zoom <= 0.65}
                  >
                    <Minus size={18} />
                  </IconButton>
                  <span />
                  <IconButton
                    label={autoRotate ? "停止自动旋转" : "自动旋转"}
                    active={autoRotate}
                    onClick={() => setAutoRotate((v) => !v)}
                  >
                    <RotateCw size={17} />
                  </IconButton>
                  <IconButton label="重置视角" onClick={resetScene}>
                    <RotateCcw size={16} />
                  </IconButton>
                  <span />
                  <IconButton
                    label={showLabels ? "隐藏器官标注" : "显示器官标注"}
                    active={showLabels}
                    onClick={() => setShowLabels((v) => !v)}
                  >
                    <ScanLine size={17} />
                  </IconButton>
                  <IconButton
                    label={sceneExpanded ? "退出专注视图" : "展开专注视图"}
                    active={sceneExpanded}
                    onClick={() => setSceneExpanded((v) => !v)}
                  >
                    {sceneExpanded ? <X size={17} /> : <Expand size={17} />}
                  </IconButton>
                </div>
                <div className="orientation-control">
                  <div className="orientation-icon">
                    <HumanMark />
                  </div>
                  <select
                    aria-label="人体观察方向"
                    value={view}
                    onChange={(e) => setView(e.target.value as View)}
                  >
                    <option value="front">正面观</option>
                    <option value="back">背面观</option>
                    <option value="left">左侧观</option>
                    <option value="right">右侧观</option>
                  </select>
                  <ChevronDown size={12} />
                </div>
                <div className="stage-coordinates" aria-hidden="true">
                  <span>
                    Y <i>↑</i>
                  </span>
                  <span>
                    X <i>→</i>
                  </span>
                  <span>
                    Z <i>↗</i>
                  </span>
                </div>
                {page === "symptoms" && (
                  <div className="symptom-scene-label">
                    <span className="pulse-dot" />
                    <div>
                      <strong>{scenario.region}</strong>
                      <span>
                        可能涉及{" "}
                        {scenario.organIds
                          .map((id) => organs.find((o) => o.id === id)?.name)
                          .filter(Boolean)
                          .join("、")}
                      </span>
                    </div>
                  </div>
                )}
                <div className="layers-panel">
                  <div className="layers-header">
                    <span>
                      <Layers3 size={14} />
                      显示图层
                    </span>
                    <span className="layers-hint">按需探索身体结构</span>
                    <button
                      onClick={() => {
                        setLayers({
                          skin: true,
                          organs: true,
                          skeleton: true,
                          vessels: false,
                          nerves: false,
                          muscles: false,
                        });
                        setSkinOpacity(0.28);
                      }}
                      aria-label="重置图层"
                      title="重置图层"
                    >
                      <SlidersHorizontal size={13} />
                    </button>
                  </div>
                  <div className="layer-options">
                    {[
                      { id: "skin", name: "皮肤", icon: PersonStanding },
                      { id: "organs", name: "器官", icon: Heart },
                      { id: "skeleton", name: "骨骼", icon: Bone },
                      { id: "vessels", name: "血管", icon: Activity },
                      { id: "nerves", name: "神经", icon: Brain },
                      { id: "muscles", name: "肌肉", icon: Move },
                    ].map((l) => {
                      const Icon = l.icon;
                      return (
                        <button
                          key={l.id}
                          aria-pressed={layers[l.id]}
                          className={layers[l.id] ? "selected" : ""}
                          onClick={() => toggleLayer(l.id)}
                          title={`${layers[l.id] ? "隐藏" : "显示"}${l.name}图层`}
                        >
                          <Icon size={15} />
                          {l.name}
                          {layers[l.id] ? (
                            <Eye size={11} />
                          ) : (
                            <EyeOff size={11} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="opacity-control">
                    <span>
                      <span className="opacity-dot" />
                      皮肤不透明度
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(skinOpacity * 100)}
                      onChange={(e) => {
                        setSkinOpacity(Number(e.target.value) / 100);
                        if (!layers.skin)
                          setLayers((v) => ({ ...v, skin: true }));
                      }}
                      aria-label="皮肤不透明度"
                      style={
                        {
                          "--range-progress": `${skinOpacity * 100}%`,
                        } as React.CSSProperties
                      }
                    />
                    <output>
                      {Math.round(skinOpacity * 100)}
                      <span>%</span>
                    </output>
                  </div>
                </div>
                <div className="stage-footer">
                  <span>
                    <MousePointer2 size={12} />
                    拖动旋转 <i />
                    滚轮缩放 <i />
                    点击探索
                  </span>
                  <span className="model-quality">
                    <span className={sceneReady ? "ready-dot" : ""} />
                    {sceneReady ? "解剖模型已就绪" : "加载解剖数据"}
                  </span>
                </div>
              </section>
              {page === "explore" ? (
                <OrganPanel
                  key={selectedOrgan}
                  organ={organ}
                  onSymptom={relatedSymptoms}
                  onDisease={showDisease}
                  onAsk={ask}
                  bookmarked={bookmarks.includes(selectedOrgan)}
                  onBookmark={toggleBookmark}
                  onSources={() => setModal("sources")}
                />
              ) : (
                <SymptomPanel
                  scenarioId={scenarioId}
                  flags={flags}
                  onFlags={setFlags}
                  onAsk={ask}
                  onSources={() => setModal("sources")}
                />
              )}
            </div>
            <section className="discovery-strip" aria-label="继续探索">
              <div className="discovery-heading">
                <span className="discovery-spark">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2>你的下一站</h2>
                  <p>让好奇，成为健康的起点</p>
                </div>
              </div>
              <button
                onClick={() => {
                  selectScenario("chest-pain");
                  navigate("symptoms");
                }}
              >
                <span className="discovery-icon coral">
                  <Activity size={21} />
                </span>
                <div>
                  <strong>身体的信号</strong>
                  <span>看懂常见症状与危险信号</span>
                </div>
                <ArrowUpRight size={16} />
              </button>
              <button onClick={() => navigate("diseases")}>
                <span className="discovery-icon blue">
                  <BookOpen size={20} />
                </span>
                <div>
                  <strong>日常健康课</strong>
                  <span>了解常见疾病与基础照护</span>
                </div>
                <ArrowUpRight size={16} />
              </button>
              <button onClick={() => ask("如何在日常生活中保护肺部？")}>
                <span className="discovery-icon mint">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <strong>和健康助手聊聊</strong>
                  <span>把你的健康疑问说清楚</span>
                </div>
                <ArrowUpRight size={16} />
              </button>
            </section>
          </>
        ) : page === "diseases" ? (
          <DiseaseLibrary
            initialDisease={initialDisease}
            onSelectOrgan={(id) => {
              selectOrgan(id);
              navigate("explore");
            }}
          />
        ) : page === "drugs" ? (
          <DrugLibrary />
        ) : (
          <HealthAssistant key={question} initialQuestion={question} />
        )}
        <footer className="site-footer">
          <p>
            <ShieldCheck size={13} />
            本平台仅用于医学知识科普，不提供诊断、处方或具体用药剂量，不替代医生诊疗。
          </p>
          <div>
            <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
              模型来源与许可
              <ArrowUpRight size={10} />
            </a>
            <button onClick={() => setModal("sources")}>内容参考来源</button>
            <span>知体 ATLAS © 2026</span>
          </div>
        </footer>
      </main>
      {modal === "help" && <HelpDialog onClose={() => setModal(null)} />}
      {modal === "sources" && <SourceDialog onClose={() => setModal(null)} />}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
