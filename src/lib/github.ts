export type Target = { kind: "repo" | "pr"; owner: string; repo: string; number?: number };

export type StoryFacts = {
  kind: "repo" | "pr";
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
};

export function parseTarget(input: string): Target | null {
  const t = input.trim();
  let m = t.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i);
  if (m) return { kind: "pr", owner: m[1]!, repo: m[2]!, number: Number(m[3]) };
  m = t.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:$|[?#])/i);
  if (m) return { kind: "repo", owner: m[1]!, repo: m[2]! };
  m = t.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { kind: "repo", owner: m[1]!, repo: m[2]! };
  return null;
}

export function canonical(t: Target): string {
  const base = `${t.owner.toLowerCase()}/${t.repo.toLowerCase()}`;
  return t.kind === "pr" ? `${base}#${t.number}` : base;
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

export async function fetchStoryFacts(t: Target): Promise<StoryFacts> {
  const base = `/repos/${t.owner}/${t.repo}`;
  let info: any;
  try {
    info = await gh(base);
  } catch (e: any) {
    if (e instanceof GhError && e.status === 404) {
      throw new Error("Repository not found or not public. RepoReel only works with public repos.");
    }
    if (e instanceof GhError && e.status === 403) {
      throw new Error("GitHub rate limit hit. Try again in a few minutes.");
    }
    throw e;
  }
  const [languages, readme, commits, contributors] = await Promise.all([
    tryGh(`${base}/languages`),
    tryGh(`${base}/readme`, true),
    tryGh(`${base}/commits?per_page=30`),
    tryGh(`${base}/contributors?per_page=8`),
  ]);
  const facts: StoryFacts = {
    kind: t.kind,
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
  };
  if (t.kind === "pr" && t.number) {
    const pr = await gh(`${base}/pulls/${t.number}`);
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
  return facts;
}
