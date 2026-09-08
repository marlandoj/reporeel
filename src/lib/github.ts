import type { Grounding } from "./options";

export type Target =
  | { kind: "repo"; owner: string; repo: string }
  | { kind: "pr"; owner: string; repo: string; number: number }
  | { kind: "release"; owner: string; repo: string; tag: string }
  | { kind: "compare"; owner: string; repo: string; base: string; head: string };

export type CodeFacts = {
  defaultBranch: string;
  fileCount: number;
  topLevel: string[];
  keyDirs: string[];
  manifest: { path: string; kind: string; name: string; dependencies: string[] } | null;
  entry: { path: string; lines: string[] } | null;
  truncated: boolean;
};

export type ChangeFacts = {
  baseRef: string;
  headRef: string;
  totalCommits: number;
  commits: { message: string; author: string; date: string }[];
  additions: number;
  deletions: number;
  changedFiles: number;
  files: { filename: string; additions: number; deletions: number }[];
};

export type StoryFacts = {
  kind: Target["kind"];
  grounding: Grounding;
  owner: string;
  repo: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  languages: Record<string, number>;
  license: string;
  createdAt: string;
  pushedAt: string;
  topics: string[];
  homepage: string;
  readmeExcerpt: string;
  recentCommits: { message: string; date: string }[];
  contributors: string[];
  releases: { count: number; latestTag: string; latestAt: string };
  code?: CodeFacts;
  pr?: {
    number: number;
    title: string;
    body: string;
    author: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    files: { filename: string; additions: number; deletions: number }[];
  };
  release?: {
    tag: string;
    name: string;
    body: string;
    publishedAt: string;
    prevTag: string;
    url: string;
    changes: ChangeFacts | null;
  };
  compare?: ChangeFacts;
};

const OWNER = "([\\w.-]+)";
const REPO = "([\\w.-]+?)";
const HOST = "^(?:https?:\\/\\/)?(?:www\\.)?github\\.com\\/";

export function parseTarget(input: string): Target | null {
  const t = input.trim();
  let m = t.match(new RegExp(`${HOST}${OWNER}\\/${REPO}\\/pull\\/(\\d+)`, "i"));
  if (m) return { kind: "pr", owner: m[1]!, repo: m[2]!, number: Number(m[3]) };
  m = t.match(new RegExp(`${HOST}${OWNER}\\/${REPO}\\/releases\\/tag\\/([^\\s?#/]+)`, "i"));
  if (m) return { kind: "release", owner: m[1]!, repo: m[2]!, tag: decodeURIComponent(m[3]!) };
  m = t.match(new RegExp(`${HOST}${OWNER}\\/${REPO}\\/releases(?:\\/latest)?\\/?(?:$|[?#])`, "i"));
  if (m) return { kind: "release", owner: m[1]!, repo: m[2]!, tag: "latest" };
  m = t.match(new RegExp(`${HOST}${OWNER}\\/${REPO}\\/compare\\/([^\\s?#]+?)\\.{2,3}([^\\s?#/]+)`, "i"));
  if (m) return { kind: "compare", owner: m[1]!, repo: m[2]!, base: decodeURIComponent(m[3]!), head: decodeURIComponent(m[4]!) };
  m = t.match(new RegExp(`${HOST}${OWNER}\\/${REPO}(?:\\.git)?\\/?(?:$|[?#])`, "i"));
  if (m) return { kind: "repo", owner: m[1]!, repo: m[2]! };
  m = t.match(/^([\w.-]+)\/([\w.-]+)@([^\s/]+)$/);
  if (m) return { kind: "release", owner: m[1]!, repo: m[2]!, tag: m[3]! };
  m = t.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { kind: "repo", owner: m[1]!, repo: m[2]! };
  return null;
}

export function canonical(t: Target): string {
  const base = `${t.owner.toLowerCase()}/${t.repo.toLowerCase()}`;
  if (t.kind === "pr") return `${base}#${t.number}`;
  if (t.kind === "release") return `${base}@${t.tag}`;
  if (t.kind === "compare") return `${base}@${t.base}...${t.head}`;
  return base;
}

export function describeTarget(t: Target): string {
  if (t.kind === "pr") return `pull request #${t.number}`;
  if (t.kind === "release") return t.tag === "latest" ? "latest release" : `release ${t.tag}`;
  if (t.kind === "compare") return `changes ${t.base}...${t.head}`;
  return "repository";
}

class GhError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

let cachedToken: string | null | undefined;

async function ghToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) {
    cachedToken = envToken;
    return cachedToken;
  }
  try {
    const proc = Bun.spawn(["gh", "auth", "token"], { env: { ...process.env }, stdout: "pipe", stderr: "ignore" });
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    cachedToken = code === 0 && out.trim() ? out.trim() : null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

async function gh(path: string, raw = false): Promise<any> {
  const headers: Record<string, string> = {
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "User-Agent": "reporeel",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = await ghToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new GhError(res.status, `GitHub API ${res.status} for ${path}`);
  return raw ? res.text() : res.json();
}

async function tryGh(path: string, raw = false): Promise<any> {
  try {
    return await gh(path, raw);
  } catch {
    return null;
  }
}

function translateError(e: unknown, what: string): Error {
  if (e instanceof GhError && e.status === 404) return new Error(`${what} not found or not public. RepoReel only works with public repos.`);
  if (e instanceof GhError && (e.status === 403 || e.status === 429)) return new Error("GitHub rate limit hit. Try again in a few minutes.");
  return e instanceof Error ? e : new Error(String(e));
}

const MANIFESTS: { file: string; kind: string }[] = [
  { file: "package.json", kind: "npm" },
  { file: "pyproject.toml", kind: "python" },
  { file: "Cargo.toml", kind: "cargo" },
  { file: "go.mod", kind: "go" },
  { file: "requirements.txt", kind: "pip" },
  { file: "Gemfile", kind: "bundler" },
  { file: "pom.xml", kind: "maven" },
  { file: "build.gradle", kind: "gradle" },
  { file: "build.gradle.kts", kind: "gradle" },
  { file: "composer.json", kind: "composer" },
  { file: "mix.exs", kind: "mix" },
  { file: "Package.swift", kind: "swiftpm" },
  { file: "pubspec.yaml", kind: "pub" },
];

const ENTRY_CANDIDATES = [
  "src/index.ts", "src/main.ts", "src/server.ts", "src/app.ts", "src/cli.ts", "src/index.tsx", "src/main.tsx", "src/App.tsx",
  "index.ts", "main.ts", "server.ts", "src/index.js", "src/main.js", "src/server.js", "index.js", "main.js", "server.js", "app.js",
  "src/main.py", "main.py", "app.py", "server.py", "cli.py", "src/app.py", "__main__.py", "manage.py",
  "main.go", "cmd/main.go", "src/main.rs", "src/lib.rs", "src/main.c", "src/main.cpp", "main.c", "main.cpp",
  "Main.java", "src/main/java/Main.java", "lib/main.dart", "Sources/main.swift", "app/main.rb", "lib/main.rb", "main.rb",
];

function parseDeps(kind: string, text: string): { name: string; deps: string[] } {
  const deps: string[] = [];
  let name = "";
  try {
    if (kind === "npm" || kind === "composer") {
      const j = JSON.parse(text);
      name = String(j.name ?? "");
      for (const k of ["dependencies", "require"]) if (j[k] && typeof j[k] === "object") deps.push(...Object.keys(j[k]));
    } else if (kind === "python") {
      name = text.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] ?? "";
      const block = text.match(/^dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1] ?? "";
      for (const m of block.matchAll(/"([A-Za-z0-9_.\-]+)/g)) deps.push(m[1]!);
      const poetry = text.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
      for (const line of poetry.split("\n")) {
        const m = line.match(/^([A-Za-z0-9_.\-]+)\s*=/);
        if (m && m[1] !== "python") deps.push(m[1]!);
      }
    } else if (kind === "cargo") {
      name = text.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] ?? "";
      const block = text.match(/\[dependencies\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
      for (const line of block.split("\n")) {
        const m = line.match(/^([A-Za-z0-9_\-]+)\s*=/);
        if (m) deps.push(m[1]!);
      }
    } else if (kind === "go") {
      name = text.match(/^module\s+(\S+)/m)?.[1] ?? "";
      for (const m of text.matchAll(/^\s*([\w.\-\/]+\.[\w\-]+\/[\w.\-\/]+)\s+v[\w.\-+]+(?!.*\/\/ indirect)/gm)) deps.push(m[1]!.split("/").slice(-1)[0]!);
    } else if (kind === "pip") {
      for (const line of text.split("\n")) {
        const m = line.trim().match(/^([A-Za-z0-9_.\-]+)/);
        if (m && !line.trim().startsWith("#") && !line.trim().startsWith("-")) deps.push(m[1]!);
      }
    } else if (kind === "bundler") {
      for (const m of text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) deps.push(m[1]!);
    } else if (kind === "pub") {
      name = text.match(/^name:\s*(\S+)/m)?.[1] ?? "";
      const block = text.match(/^dependencies:\n([\s\S]*?)(?:\n\S|$)/m)?.[1] ?? "";
      for (const m of block.matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)) deps.push(m[1]!);
    } else if (kind === "maven") {
      for (const m of text.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)) deps.push(m[1]!);
    } else if (kind === "gradle") {
      for (const m of text.matchAll(/(?:implementation|api|compile)\s*[("']+([^:"')]+:[^:"')]+)/g)) deps.push(m[1]!.split(":")[1]!);
    } else if (kind === "mix") {
      for (const m of text.matchAll(/\{:([a-z_0-9]+),/g)) deps.push(m[1]!);
    } else if (kind === "swiftpm") {
      for (const m of text.matchAll(/url:\s*"[^"]*\/([^"\/]+?)(?:\.git)?"/g)) deps.push(m[1]!);
    }
  } catch {}
  return { name, deps: [...new Set(deps)].slice(0, 14) };
}

function trimSnippet(text: string): string[] {
  const raw = text.replace(/\r/g, "").split("\n").slice(0, 120);
  let i = 0;
  while (i < raw.length && (/^\s*(\/\/|#|\*|\/\*|"""|'''|<!--|--)/.test(raw[i]!) || raw[i]!.trim() === "")) i++;
  if (i >= raw.length) i = 0;
  const lines = raw.slice(i).filter((l) => l.trim() !== "" || true).slice(0, 40);
  return lines.map((l) => l.replace(/\t/g, "  ").slice(0, 100));
}

async function fetchCodeFacts(base: string, defaultBranch: string): Promise<CodeFacts | null> {
  const tree = await tryGh(`${base}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`);
  if (!tree || !Array.isArray(tree.tree)) return null;
  const entries: { path: string; type: string }[] = tree.tree;
  const files = entries.filter((e) => e.type === "blob");
  const paths = new Set(files.map((f) => f.path));
  const topLevel = entries.filter((e) => !e.path.includes("/")).map((e) => (e.type === "tree" ? `${e.path}/` : e.path)).slice(0, 40);
  const dirCounts = new Map<string, number>();
  for (const f of files) {
    const parts = f.path.split("/");
    if (parts.length > 1) dirCounts.set(parts[0]!, (dirCounts.get(parts[0]!) ?? 0) + 1);
  }
  const keyDirs = [...dirCounts.entries()]
    .filter(([d]) => !/^(node_modules|vendor|dist|build|\.git|__pycache__|target)$/.test(d))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([d, n]) => `${d}/ (${n} files)`);
  const manifestHit = MANIFESTS.find((m) => paths.has(m.file));
  let manifest: CodeFacts["manifest"] = null;
  let entryCandidates: string[] = [];
  if (manifestHit) {
    const text = await tryGh(`${base}/contents/${manifestHit.file}?ref=${encodeURIComponent(defaultBranch)}`, true);
    if (typeof text === "string") {
      const { name, deps } = parseDeps(manifestHit.kind, text);
      manifest = { path: manifestHit.file, kind: manifestHit.kind, name, dependencies: deps };
      if (manifestHit.kind === "npm") {
        try {
          const j = JSON.parse(text);
          const fromBin = typeof j.bin === "string" ? [j.bin] : j.bin && typeof j.bin === "object" ? Object.values(j.bin) : [];
          const start = typeof j.scripts?.start === "string" ? j.scripts.start.match(/(\S+\.(?:[cm]?[jt]sx?))(?:\s|$)/)?.[1] : undefined;
          entryCandidates = [j.main, j.module, ...fromBin, start].filter((x): x is string => typeof x === "string").map((p) => p.replace(/^\.\//, ""));
        } catch {}
      }
    }
  }
  let entry: CodeFacts["entry"] = null;
  const candidates = [...entryCandidates, ...ENTRY_CANDIDATES].filter((p) => paths.has(p));
  if (candidates.length === 0) {
    const source = files
      .filter((f) => /\.(ts|tsx|js|py|go|rs|rb|java|swift|kt|c|cpp|cs|php|ex|dart|zig)$/.test(f.path))
      .filter((f) => !/(^|\/)\./.test(f.path) && !/(^|\/)(test|tests|spec|__tests__|docs?|examples?|scripts?|bench|benchmarks?|vendor|node_modules)\//.test(f.path) && !/\.(test|spec|d)\.[jt]sx?$/.test(f.path))
      .map((f) => f.path);
    const score = (p: string) => (/^(src|lib|cmd|app|packages)\//.test(p) ? 0 : 1) * 100 + p.split("/").length * 10 + (/(^|\/)(main|index|app|server|cli|lib)\./.test(p) ? 0 : 1);
    source.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
    if (source[0]) candidates.push(source[0]);
  }
  if (candidates[0]) {
    const text = await tryGh(`${base}/contents/${candidates[0].split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(defaultBranch)}`, true);
    if (typeof text === "string" && text.length > 0) entry = { path: candidates[0], lines: trimSnippet(text) };
  }
  return {
    defaultBranch,
    fileCount: files.length,
    topLevel,
    keyDirs,
    manifest,
    entry,
    truncated: Boolean(tree.truncated),
  };
}

function summarizeCompare(baseRef: string, headRef: string, cmp: any): ChangeFacts {
  const commits: any[] = Array.isArray(cmp?.commits) ? cmp.commits : [];
  const files: any[] = Array.isArray(cmp?.files) ? cmp.files : [];
  return {
    baseRef,
    headRef,
    totalCommits: Number(cmp?.total_commits ?? commits.length),
    commits: commits
      .slice(-40)
      .reverse()
      .map((c) => ({
        message: (String(c.commit?.message ?? "").split("\n")[0] ?? "").slice(0, 100),
        author: c.author?.login ?? c.commit?.author?.name ?? "",
        date: c.commit?.author?.date ?? "",
      })),
    additions: files.reduce((a, f) => a + (f.additions ?? 0), 0),
    deletions: files.reduce((a, f) => a + (f.deletions ?? 0), 0),
    changedFiles: files.length,
    files: files
      .slice()
      .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
      .slice(0, 10)
      .map((f) => ({ filename: f.filename, additions: f.additions ?? 0, deletions: f.deletions ?? 0 })),
  };
}

export async function fetchStoryFacts(t: Target, grounding: Grounding = "both"): Promise<StoryFacts> {
  const base = `/repos/${t.owner}/${t.repo}`;
  let info: any;
  try {
    info = await gh(base);
  } catch (e) {
    throw translateError(e, "Repository");
  }
  const defaultBranch: string = info.default_branch ?? "main";
  const wantReadme = grounding !== "code";
  const wantCode = grounding !== "readme";
  const [languages, readme, commits, contributors, releaseList, code] = await Promise.all([
    tryGh(`${base}/languages`),
    wantReadme ? tryGh(`${base}/readme`, true) : Promise.resolve(null),
    tryGh(`${base}/commits?per_page=30`),
    tryGh(`${base}/contributors?per_page=8`),
    tryGh(`${base}/releases?per_page=12`),
    wantCode ? fetchCodeFacts(base, defaultBranch) : Promise.resolve(null),
  ]);
  const releases: any[] = Array.isArray(releaseList) ? releaseList.filter((r) => !r.draft) : [];
  const facts: StoryFacts = {
    kind: t.kind,
    grounding,
    owner: info.owner?.login ?? t.owner,
    repo: info.name ?? t.repo,
    url: info.html_url ?? `https://github.com/${t.owner}/${t.repo}`,
    description: info.description ?? "",
    stars: info.stargazers_count ?? 0,
    forks: info.forks_count ?? 0,
    openIssues: info.open_issues_count ?? 0,
    language: info.language ?? "",
    languages: languages ?? {},
    license: info.license?.spdx_id ?? "",
    createdAt: info.created_at ?? "",
    pushedAt: info.pushed_at ?? "",
    topics: info.topics ?? [],
    homepage: info.homepage ?? "",
    readmeExcerpt: typeof readme === "string" ? readme.slice(0, 7000) : "",
    recentCommits: Array.isArray(commits)
      ? commits.slice(0, 12).map((c: any) => ({
          message: (String(c.commit?.message ?? "").split("\n")[0] ?? "").slice(0, 90),
          date: c.commit?.author?.date ?? "",
        }))
      : [],
    contributors: Array.isArray(contributors) ? contributors.map((c: any) => c.login) : [],
    releases: {
      count: releases.length,
      latestTag: releases[0]?.tag_name ?? "",
      latestAt: releases[0]?.published_at ?? "",
    },
  };
  if (code) facts.code = code;
  if (t.kind === "pr") {
    let pr: any;
    try {
      pr = await gh(`${base}/pulls/${t.number}`);
    } catch (e) {
      throw translateError(e, `Pull request #${t.number}`);
    }
    const files = await tryGh(`${base}/pulls/${t.number}/files?per_page=50`);
    facts.pr = {
      number: t.number,
      title: pr.title ?? "",
      body: String(pr.body ?? "").slice(0, 3000),
      author: pr.user?.login ?? "",
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changed_files ?? 0,
      files: Array.isArray(files)
        ? files
            .sort((a: any, b: any) => b.additions + b.deletions - (a.additions + a.deletions))
            .slice(0, 8)
            .map((f: any) => ({ filename: f.filename, additions: f.additions, deletions: f.deletions }))
        : [],
    };
  }
  if (t.kind === "release") {
    let rel: any;
    try {
      rel = t.tag === "latest" ? await gh(`${base}/releases/latest`) : await gh(`${base}/releases/tags/${encodeURIComponent(t.tag)}`);
    } catch (e) {
      throw translateError(e, t.tag === "latest" ? "A published release" : `Release ${t.tag}`);
    }
    const tag: string = rel.tag_name ?? t.tag;
    const idx = releases.findIndex((r) => r.tag_name === tag);
    const prev = idx >= 0 ? releases[idx + 1] : releases.find((r) => r.tag_name !== tag && r.published_at && rel.published_at && r.published_at < rel.published_at);
    const prevTag: string = prev?.tag_name ?? "";
    const cmp = prevTag ? await tryGh(`${base}/compare/${encodeURIComponent(prevTag)}...${encodeURIComponent(tag)}`) : null;
    facts.release = {
      tag,
      name: rel.name ?? tag,
      body: String(rel.body ?? "").slice(0, 4000),
      publishedAt: rel.published_at ?? "",
      prevTag,
      url: rel.html_url ?? `${facts.url}/releases/tag/${encodeURIComponent(tag)}`,
      changes: cmp ? summarizeCompare(prevTag, tag, cmp) : null,
    };
  }
  if (t.kind === "compare") {
    let cmp: any;
    try {
      cmp = await gh(`${base}/compare/${encodeURIComponent(t.base)}...${encodeURIComponent(t.head)}`);
    } catch (e) {
      throw translateError(e, `Comparison ${t.base}...${t.head}`);
    }
    facts.compare = summarizeCompare(t.base, t.head, cmp);
  }
  return facts;
}

export async function fetchFreshness(t: Target): Promise<{ pushedAt: string; latestTag: string }> {
  const base = `/repos/${t.owner}/${t.repo}`;
  const info = await gh(base);
  let latestTag = "";
  if (t.kind === "release") {
    const rel = await tryGh(`${base}/releases/latest`);
    latestTag = rel?.tag_name ?? "";
  }
  return { pushedAt: info.pushed_at ?? "", latestTag };
}
