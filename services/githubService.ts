/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { RepoFileTree, DataFlowGraph, D3Node, D3Link, RepoActivityStats, RepoCommitActivity, DayOfWeekActivity } from '../types';

export interface RepoSourceInfo {
  owner: string;
  repo: string;
  provider: 'github' | 'netlify';
  siteName?: string;
}

export function parseRepoSourceInput(input: string): RepoSourceInfo | null {
  const cleanInput = input.trim().replace(/\/$/, '');
  if (!cleanInput) return null;

  // Check if it's a Netlify URL
  if (cleanInput.includes('netlify.app') || cleanInput.includes('netlify.com')) {
    try {
      const url = new URL(cleanInput.startsWith('http') ? cleanInput : `https://${cleanInput}`);
      if (url.hostname.endsWith('.netlify.app')) {
        const siteName = url.hostname.replace('.netlify.app', '');
        return {
          owner: siteName,
          repo: siteName,
          provider: 'netlify',
          siteName
        };
      }
      if (url.hostname === 'app.netlify.com' && url.pathname.includes('/sites/')) {
        const parts = url.pathname.split('/sites/')[1]?.split('/');
        if (parts && parts[0]) {
          return {
            owner: parts[0],
            repo: parts[0],
            provider: 'netlify',
            siteName: parts[0]
          };
        }
      }
    } catch (e) {}
  }

  // Check if it's a GitHub URL
  try {
    const url = new URL(cleanInput.startsWith('http') ? cleanInput : `https://${cleanInput}`);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1].replace(/\.git$/, ''),
          provider: 'github'
        };
      }
    }
  } catch (e) {}

  // Standard owner/repo format
  const parts = cleanInput.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ''),
      provider: 'github'
    };
  }

  return null;
}

export function buildGraphFromFileTree(repoName: string, fileTree: RepoFileTree[]): DataFlowGraph {
  const nodes: D3Node[] = [
    { id: 'root', label: repoName, group: 0 }
  ];
  const links: D3Link[] = [];

  const addedNodes = new Set<string>(['root']);
  const maxFiles = 50;
  const sampleTree = fileTree.slice(0, maxFiles);

  sampleTree.forEach((file) => {
    const parts = file.path.split('/');
    let currentPath = '';

    parts.forEach((part, idx) => {
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!addedNodes.has(currentPath)) {
        nodes.push({
          id: currentPath,
          label: part,
          group: idx + 1
        });
        addedNodes.add(currentPath);

        const sourceId = prevPath || 'root';
        links.push({
          source: sourceId,
          target: currentPath,
          value: Math.max(1, 5 - idx)
        });
      }
    });
  });

  return { nodes, links };
}

export async function fetchDeployedBuildOutput(urlStr: string): Promise<string | null> {
  try {
    const fullUrl = urlStr.startsWith('http://') || urlStr.startsWith('https://') 
      ? urlStr 
      : `https://${urlStr}`;
    
    const res = await fetch(fullUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Compatible; RepoAnalyzer/1.0)'
      }
    });

    if (!res.ok) return null;

    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Site';

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const metaDesc = metaMatch ? metaMatch[1].trim() : '';

    // Extract scripts
    const scripts: string[] = [];
    const scriptMatches = html.matchAll(/<script[^>]*src=["']([^"']*)["'][^>]*>/gi);
    for (const match of scriptMatches) {
      if (match[1]) scripts.push(match[1]);
    }

    // Extract link tags / CSS
    const cssLinks: string[] = [];
    const linkMatches = html.matchAll(/<link[^>]*href=["']([^"']*)["'][^>]*>/gi);
    for (const match of linkMatches) {
      if (match[1] && match[1].includes('.css')) cssLinks.push(match[1]);
    }

    // Extract clean body DOM text structure
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;
    const cleanBodyText = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '[SVG Icon]')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return [
      `Site URL: ${fullUrl}`,
      `HTML Title: ${title}`,
      metaDesc ? `Meta Description: ${metaDesc}` : null,
      scripts.length > 0 ? `Detected JS Bundles/Scripts: ${scripts.join(', ')}` : null,
      cssLinks.length > 0 ? `Detected Stylesheets: ${cssLinks.join(', ')}` : null,
      `Rendered Page Text Content (first 2500 chars):\n${cleanBodyText.slice(0, 2500)}`
    ].filter(Boolean).join('\n');

  } catch (err) {
    console.warn('Could not fetch live deployed output:', err);
    return null;
  }
}

export async function enrichRepoTreeWithFileContents(
  owner: string,
  repo: string,
  fileTree: RepoFileTree[],
  token?: string,
  activeBranch: string = 'main'
): Promise<RepoFileTree[]> {
  const KEY_PATTERNS = [
    /^package\.json$/i,
    /^readme\.md$/i,
    /^readme$/i,
    /^dockerfile$/i,
    /^docker-compose\.yml$/i,
    /^(vite|next|webpack|tailwind)\.config\.(js|ts|mjs|cjs)$/i,
    /^tsconfig\.json$/i,
    /^(server|app|index|main)\.(ts|js|py|go|rs|java|cs)$/i,
    /^src\/(app|index|main|server|routes)\.(tsx|jsx|ts|js)$/i,
    /^src\/App\.(tsx|jsx|ts|js)$/i
  ];

  const candidateFiles = fileTree.filter(f => 
    KEY_PATTERNS.some(pattern => pattern.test(f.path))
  ).slice(0, 8); // Max 8 key files

  if (candidateFiles.length === 0) return fileTree;

  const headers: Record<string, string> = {};
  if (token && token.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  const enrichedTree = [...fileTree];

  await Promise.allSettled(candidateFiles.map(async (keyFile) => {
    try {
      // Try raw github usercontent first
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${activeBranch}/${keyFile.path}`;
      const res = await fetch(rawUrl, { headers });

      if (res.ok) {
        const text = await res.text();
        const treeIndex = enrichedTree.findIndex(item => item.path === keyFile.path);
        if (treeIndex !== -1) {
          enrichedTree[treeIndex] = {
            ...enrichedTree[treeIndex],
            content: text.slice(0, 3000), // Cap at 3000 characters
            isKeyFile: true
          };
        }
      }
    } catch (e) {
      console.warn(`Failed to pre-fetch key file ${keyFile.path}`, e);
    }
  }));

  return enrichedTree;
}

export async function fetchRepoFileTree(
  owner: string, 
  repo: string, 
  token?: string, 
  branchPreference?: string,
  siteUrl?: string
): Promise<RepoFileTree[]> {
  const branches = branchPreference 
    ? [branchPreference, 'main', 'master', 'dev', 'develop']
    : ['main', 'master', 'dev', 'develop'];

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token && token.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  let rawTree: RepoFileTree[] = [];
  let workingBranch = 'main';

  for (const branch of Array.from(new Set(branches))) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.truncated) {
          console.warn('Warning: Repository tree is too large and was truncated by GitHub API.');
        }

        workingBranch = branch;
        // Filter for relevant code and config files to reduce noise for the AI
        rawTree = (data.tree || []).filter((item: any) => 
          item.type === 'blob' && 
          item.path.match(/\.(js|jsx|ts|tsx|py|go|rs|java|c|cpp|h|hpp|cs|php|rb|swift|kt|dart|json|yaml|yml|toml|xml|html|css)$/i) &&
          !item.path.includes('node_modules') &&
          !item.path.includes('dist/') &&
          !item.path.includes('build/') &&
          !item.path.startsWith('.')
        );
        break;
      }

      // Handle specific GitHub API error codes
      if (response.status === 401) {
        throw new Error('Unauthorized: Invalid GitHub Personal Access Token. Please check your PAT token in the 🔒 settings.');
      }
      if (response.status === 403 || response.status === 429) {
        throw new Error('GitHub API rate limit exceeded. Click the 🔒 icon to enter a Personal Access Token to bypass rate limits.');
      }
      
    } catch (error: any) {
      if (error.message.includes('rate limit') || error.message.includes('Unauthorized')) {
        throw error;
      }
      if (branch === branches[branches.length - 1]) {
         console.error('Error fetching repo tree:', error);
      }
    }
  }

  // If tree was fetched, enrich it with actual key file contents
  if (rawTree.length > 0) {
    let enriched = await enrichRepoTreeWithFileContents(owner, repo, rawTree, token, workingBranch);
    
    // If site URL or deployed output is provided/detectable, fetch deployed output
    if (siteUrl) {
      const deployedOutput = await fetchDeployedBuildOutput(siteUrl);
      if (deployedOutput) {
        enriched.push({
          path: '__BUILT_DEPLOYED_OUTPUT__',
          type: 'blob',
          content: deployedOutput,
          isKeyFile: true
        });
      }
    }
    return enriched;
  }

  // If we exit the loop without returning, none of the branches worked.
  if (token && token.trim()) {
    throw new Error(`Repository "${owner}/${repo}" could not be found or accessed. Please check the repository name and verify that your GitHub Token has 'repo' scope access.`);
  } else {
    throw new Error(`Repository "${owner}/${repo}" was not found or is private. Public repositories do NOT require a token. If this is a private repository, click the 🔒 icon to enter your GitHub Personal Access Token (PAT).`);
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function fetchRepoActivityStats(
  owner: string,
  repo: string,
  token?: string,
  branchPreference?: string,
  fallbackFileTree?: RepoFileTree[]
): Promise<RepoActivityStats> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token && token.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  const branches = branchPreference 
    ? [branchPreference, 'main', 'master', 'dev'] 
    : ['main', 'master', 'dev', ''];

  let commitsData: any[] = [];
  let fetchSucceeded = false;

  for (const branch of branches) {
    try {
      const url = branch 
        ? `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&sha=${branch}`
        : `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`;

      const response = await fetch(url, { headers });
      if (response.ok) {
        commitsData = await response.json();
        if (Array.isArray(commitsData) && commitsData.length > 0) {
          fetchSucceeded = true;
          break;
        }
      }
    } catch (e) {
      // Try next branch or fallback
    }
  }

  if (fetchSucceeded && commitsData.length > 0) {
    return processCommitsIntoActivityStats(commitsData);
  }

  // Fallback to simulated activity trend based on repo metadata & files
  return generateSimulatedRepoActivity(`${owner}/${repo}`, fallbackFileTree);
}

function processCommitsIntoActivityStats(commits: any[]): RepoActivityStats {
  const dayMap: Record<string, { count: number; authors: Set<string>; messages: string[]; rawDate: Date }> = {};
  const allAuthors = new Set<string>();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat

  commits.forEach(c => {
    const rawDateStr = c.commit?.author?.date || c.commit?.committer?.date;
    if (!rawDateStr) return;
    const dateObj = new Date(rawDateStr);
    if (isNaN(dateObj.getTime())) return;

    const dateKey = dateObj.toISOString().split('T')[0];
    const authorName = c.commit?.author?.name || c.author?.login || 'Developer';
    allAuthors.add(authorName);

    const dayOfWeek = dateObj.getDay();
    dayOfWeekCounts[dayOfWeek]++;

    const msg = (c.commit?.message || 'Update codebase').split('\n')[0].slice(0, 100);

    if (!dayMap[dateKey]) {
      dayMap[dateKey] = {
        count: 0,
        authors: new Set<string>(),
        messages: [],
        rawDate: dateObj
      };
    }
    dayMap[dateKey].count++;
    dayMap[dateKey].authors.add(authorName);
    if (dayMap[dateKey].messages.length < 4) {
      dayMap[dateKey].messages.push(msg);
    }
  });

  const sortedDates = Object.keys(dayMap).sort();
  if (sortedDates.length === 0) {
    return generateSimulatedRepoActivity('repository');
  }

  // Generate continuous timeline (including days with 0 commits to prevent distortion)
  const minDate = new Date(sortedDates[0]);
  const maxDate = new Date(sortedDates[sortedDates.length - 1]);
  
  // Cap max days to 90 days to maintain high resolution visualization
  const diffDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const startDate = diffDays > 90 ? new Date(maxDate.getTime() - 90 * 24 * 60 * 60 * 1000) : minDate;

  const continuousTimeline: RepoCommitActivity[] = [];
  const curr = new Date(startDate);

  while (curr <= maxDate) {
    const dateKey = curr.toISOString().split('T')[0];
    const entry = dayMap[dateKey];
    const formattedDate = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    continuousTimeline.push({
      date: dateKey,
      formattedDate,
      count: entry ? entry.count : 0,
      authors: entry ? Array.from(entry.authors) : [],
      sampleMessages: entry ? entry.messages : [],
      isSpike: false
    });

    curr.setDate(curr.getDate() + 1);
  }

  // Calculate moving average and detect spikes
  const nonZeroCounts = continuousTimeline.map(t => t.count);
  const totalCommits = nonZeroCounts.reduce((a, b) => a + b, 0);
  const avgCommitsPerDay = totalCommits / Math.max(1, continuousTimeline.length);

  // Spike threshold calculation: mean + 1.35 * stdDev, minimum 3 commits
  const variance = nonZeroCounts.reduce((acc, count) => acc + Math.pow(count - avgCommitsPerDay, 2), 0) / continuousTimeline.length;
  const stdDev = Math.sqrt(variance);
  const spikeThreshold = Math.max(3, Math.ceil(avgCommitsPerDay + 1.35 * stdDev));

  let peakDay: { date: string; formattedDate: string; count: number } | null = null;
  const spikesList: RepoCommitActivity[] = [];

  for (let i = 0; i < continuousTimeline.length; i++) {
    // 5-day moving average
    const startIdx = Math.max(0, i - 2);
    const endIdx = Math.min(continuousTimeline.length - 1, i + 2);
    let windowSum = 0;
    for (let w = startIdx; w <= endIdx; w++) {
      windowSum += continuousTimeline[w].count;
    }
    continuousTimeline[i].movingAverage = Math.round((windowSum / (endIdx - startIdx + 1)) * 10) / 10;

    // Check for activity spike
    if (continuousTimeline[i].count >= spikeThreshold) {
      continuousTimeline[i].isSpike = true;
      spikesList.push(continuousTimeline[i]);
    }

    if (!peakDay || continuousTimeline[i].count > peakDay.count) {
      peakDay = {
        date: continuousTimeline[i].date,
        formattedDate: continuousTimeline[i].formattedDate,
        count: continuousTimeline[i].count
      };
    }
  }

  // Calculate velocity trend: compare second half vs first half
  const halfLen = Math.floor(continuousTimeline.length / 2);
  const firstHalfTotal = continuousTimeline.slice(0, halfLen).reduce((a, b) => a + b.count, 0);
  const secondHalfTotal = continuousTimeline.slice(halfLen).reduce((a, b) => a + b.count, 0);
  let velocityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (secondHalfTotal > firstHalfTotal * 1.25) velocityTrend = 'increasing';
  else if (secondHalfTotal < firstHalfTotal * 0.75) velocityTrend = 'decreasing';

  // Day of week distribution
  const dayOfWeekDistribution: DayOfWeekActivity[] = DAY_NAMES.map((day, idx) => ({
    day,
    dayIndex: idx,
    count: dayOfWeekCounts[idx],
    percentage: totalCommits > 0 ? Math.round((dayOfWeekCounts[idx] / totalCommits) * 100) : 0
  }));

  return {
    totalCommits,
    timeline: continuousTimeline,
    peakDay,
    activeContributors: Math.max(1, allAuthors.size),
    averagePerDay: Math.round(avgCommitsPerDay * 10) / 10,
    velocityTrend,
    spikesCount: spikesList.length,
    spikesList,
    dayOfWeekDistribution,
    source: 'live_github',
    dateRange: {
      start: continuousTimeline[0]?.formattedDate || '',
      end: continuousTimeline[continuousTimeline.length - 1]?.formattedDate || ''
    }
  };
}

function generateSimulatedRepoActivity(repoName: string, fileTree?: RepoFileTree[]): RepoActivityStats {
  // Deterministic seed based on repoName
  let hash = 0;
  for (let i = 0; i < repoName.length; i++) {
    hash = (hash << 5) - hash + repoName.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);

  const daysCount = 45;
  const timeline: RepoCommitActivity[] = [];
  const today = new Date();
  const baseFiles = fileTree ? fileTree.length : 35;
  const baseIntensity = Math.max(1, Math.min(6, Math.floor(baseFiles / 15)));

  const mockAuthors = ['core-dev', 'lead-architect', 'contributor', 'bot-ci'];
  const mockMessages = [
    'feat: core architecture refactor',
    'fix: resolve race conditions in data pipeline',
    'perf: optimize bundle tree shaking and render loops',
    'docs: update API schema and deployment guides',
    'chore: update dependencies and CI workflows',
    'feat: add telemetry hooks and state caching',
    'feat: implement reactive state sync',
    'refactor: extract modular utility helpers'
  ];

  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  let totalCommits = 0;
  let peakDay: { date: string; formattedDate: string; count: number } | null = null;
  const spikesList: RepoCommitActivity[] = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayOfWeek = d.getDay();
    const dateKey = d.toISOString().split('T')[0];
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Weekend lower activity
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendDampener = isWeekend ? 0.25 : 1.0;

    // Pseudo-random daily count with periodic sprint release spikes
    const pseudoRand = Math.sin((seed + i * 17) * 0.45);
    const spikeChance = Math.sin((seed + i * 7) * 0.85);

    let count = 0;
    let isSpike = false;

    if (spikeChance > 0.72) {
      // Activity spike day (sprint push / release)
      count = Math.floor((baseIntensity * 2.8) + (pseudoRand * 2) + 4);
      isSpike = true;
    } else if (pseudoRand > -0.2) {
      count = Math.floor(((pseudoRand + 0.5) * baseIntensity * 1.5) * weekendDampener);
    }

    count = Math.max(0, count);
    totalCommits += count;
    dayOfWeekCounts[dayOfWeek] += count;

    const authors = count > 0 
      ? mockAuthors.slice(0, Math.min(mockAuthors.length, Math.floor(count / 2) + 1)) 
      : [];

    const messages = count > 0 
      ? mockMessages.slice(i % 3, (i % 3) + Math.min(3, count))
      : [];

    const item: RepoCommitActivity = {
      date: dateKey,
      formattedDate,
      count,
      authors,
      sampleMessages: messages,
      isSpike
    };

    if (isSpike) {
      spikesList.push(item);
    }

    if (!peakDay || count > peakDay.count) {
      peakDay = { date: dateKey, formattedDate, count };
    }

    timeline.push(item);
  }

  // Calculate moving averages
  for (let i = 0; i < timeline.length; i++) {
    const startIdx = Math.max(0, i - 2);
    const endIdx = Math.min(timeline.length - 1, i + 2);
    let sum = 0;
    for (let w = startIdx; w <= endIdx; w++) sum += timeline[w].count;
    timeline[i].movingAverage = Math.round((sum / (endIdx - startIdx + 1)) * 10) / 10;
  }

  const avgPerDay = Math.round((totalCommits / daysCount) * 10) / 10;
  const dayOfWeekDistribution: DayOfWeekActivity[] = DAY_NAMES.map((day, idx) => ({
    day,
    dayIndex: idx,
    count: dayOfWeekCounts[idx],
    percentage: totalCommits > 0 ? Math.round((dayOfWeekCounts[idx] / totalCommits) * 100) : 0
  }));

  return {
    totalCommits,
    timeline,
    peakDay,
    activeContributors: Math.min(mockAuthors.length, Math.max(2, baseIntensity)),
    averagePerDay: avgPerDay,
    velocityTrend: 'increasing',
    spikesCount: spikesList.length,
    spikesList,
    dayOfWeekDistribution,
    source: 'simulated_fallback',
    dateRange: {
      start: timeline[0]?.formattedDate || '',
      end: timeline[timeline.length - 1]?.formattedDate || ''
    }
  };
}
