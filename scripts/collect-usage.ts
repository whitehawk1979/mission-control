#!/usr/bin/env npx tsx
/**
 * Mission Control Usage Collector
 * Gathers current state from OpenClaw APIs and updates dashboard-data.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  lastRunStatus?: string;
  consecutiveErrors?: number;
  lastError?: string;
  currentlyRunning?: boolean;
}

interface Session {
  sessionKey: string;
  displayName?: string;
  status: string;
  model?: string;
  startedAt?: string;
  tokens?: number;
  subagents?: number;
}

interface DashboardData {
  lastUpdated: string;
  lastUpdatedHuman: string;
  systemHealth: {
    status: string;
    issues: number;
    details: string[];
  };
  actionRequired: Array<{
    level: string;
    source: string;
    jobId?: string;
    name: string;
    issue: string;
    lastError?: string;
    recommendation?: string;
  }>;
  activeNow: Array<{
    sessionKey: string;
    displayName?: string;
    status: string;
    model?: string;
    startedAt?: string;
    tokens?: number;
    subagents?: number;
  }>;
  crons: {
    total: number;
    enabled: number;
    disabled: number;
    summary: {
      ok: number;
      error: number;
      pending: number;
    };
    withErrors: Array<{
      id: string;
      name: string;
      consecutiveErrors?: number;
      lastError?: string;
      lastRunStatus?: string;
      schedule?: string;
      currentlyRunning?: boolean;
    }>;
    recentSuccessful: Array<{
      name: string;
      lastRun: string;
      durationMs?: number;
      status: string;
    }>;
  };
  recentActivity: Array<{
    time: string;
    type: string;
    name: string;
    status: string;
    duration?: string;
    subagents?: number;
  }>;
  stats: {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalCrons: number;
    healthyCrons: number;
    errorCrons: number;
    pendingReminders: number;
  };
}

// OpenClaw API base URL (internal)
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

async function fetchGatewayAPI(endpoint: string): Promise<any> {
  const url = `${GATEWAY_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (GATEWAY_TOKEN) {
    headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
  }
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function collectCronJobs(): Promise<CronJob[]> {
  try {
    const data = await fetchGatewayAPI('/cron?action=list');
    return data.jobs || [];
  } catch (error) {
    console.error('Failed to fetch cron jobs:', error);
    return [];
  }
}

async function collectSessions(): Promise<Session[]> {
  try {
    const data = await fetchGatewayAPI('/sessions?action=list');
    return data.sessions || [];
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function getHumanTimestamp(): string {
  return new Date().toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function buildDashboardData(crons: CronJob[], sessions: Session[]): Promise<DashboardData> {
  const now = new Date().toISOString();
  
  // Count cron statuses
  const totalCrons = crons.length;
  const enabledCrons = crons.filter(c => c.enabled).length;
  const disabledCrons = totalCrons - enabledCrons;
  
  const errorCrons = crons.filter(c => c.lastRunStatus === 'error' || (c.consecutiveErrors && c.consecutiveErrors > 0));
  const okCrons = crons.filter(c => c.lastRunStatus === 'ok');
  const pendingCrons = crons.filter(c => c.lastRunStatus === 'pending' || !c.lastRunStatus);
  
  // Find sessions with errors
  const errorDetails: string[] = [];
  if (errorCrons.length > 0) {
    for (const cron of errorCrons.slice(0, 5)) { // Limit to 5
      const running = cron.currentlyRunning ? ' (currently running)' : '';
      errorDetails.push(`${cron.name}: ${cron.consecutiveErrors || 1} consecutive errors${running}`);
    }
  }
  
  // Build action required items
  const actionRequired: DashboardData['actionRequired'] = [];
  
  for (const cron of errorCrons) {
    if (cron.consecutiveErrors && cron.consecutiveErrors >= 2) {
      actionRequired.push({
        level: cron.consecutiveErrors >= 5 ? 'critical' : 'warning',
        source: 'cron',
        jobId: cron.id,
        name: cron.name,
        issue: `${cron.consecutiveErrors} consecutive timeout errors`,
        lastError: cron.lastError || 'timeout',
        recommendation: `Increase timeout or investigate slow execution`
      });
    }
  }
  
  // Build active sessions
  const activeNow: DashboardData['activeNow'] = sessions
    .filter(s => s.status === 'running' || s.status === 'active')
    .map(s => ({
      sessionKey: s.sessionKey,
      displayName: s.displayName || s.sessionKey.split(':').pop(),
      status: s.status,
      model: s.model,
      startedAt: s.startedAt,
      tokens: s.tokens,
      subagents: s.subagents
    }));
  
  // Build recent activity
  const recentActivity: DashboardData['recentActivity'] = [];
  
  // Add recent cron completions
  const recentCrons = crons
    .filter(c => c.lastRun && c.lastRunStatus === 'ok')
    .sort((a, b) => (b.lastRun || '').localeCompare(a.lastRun || ''))
    .slice(0, 5);
  
  for (const cron of recentCrons) {
    recentActivity.push({
      time: cron.lastRun!,
      type: 'cron_completed',
      name: cron.name,
      status: 'ok'
    });
  }
  
  // Add active sessions
  for (const session of activeNow.slice(0, 3)) {
    recentActivity.push({
      time: session.startedAt || now,
      type: 'session_active',
      name: session.displayName || session.sessionKey,
      status: session.status,
      subagents: session.subagents
    });
  }
  
  // Sort by time descending
  recentActivity.sort((a, b) => b.time.localeCompare(a.time));
  
  // Build stats
  const stats: DashboardData['stats'] = {
    totalSessions: sessions.length,
    activeSessions: activeNow.length,
    completedSessions: sessions.filter(s => s.status === 'completed').length,
    totalCrons,
    healthyCrons: okCrons.length,
    errorCrons: errorCrons.length,
    pendingReminders: pendingCrons.length
  };
  
  // Determine system health
  let systemStatus = 'healthy';
  if (errorCrons.length >= 3) {
    systemStatus = 'critical';
  } else if (errorCrons.length >= 1) {
    systemStatus = 'degraded';
  }
  
  return {
    lastUpdated: now,
    lastUpdatedHuman: getHumanTimestamp(),
    systemHealth: {
      status: systemStatus,
      issues: errorDetails.length,
      details: errorDetails
    },
    actionRequired,
    activeNow,
    crons: {
      total: totalCrons,
      enabled: enabledCrons,
      disabled: disabledCrons,
      summary: {
        ok: okCrons.length,
        error: errorCrons.length,
        pending: pendingCrons.length
      },
      withErrors: errorCrons.map(c => ({
        id: c.id,
        name: c.name,
        consecutiveErrors: c.consecutiveErrors,
        lastError: c.lastError,
        lastRunStatus: c.lastRunStatus,
        schedule: c.schedule,
        currentlyRunning: c.currentlyRunning
      })),
      recentSuccessful: recentCrons.map(c => ({
        name: c.name,
        lastRun: c.lastRun!,
        status: 'ok'
      }))
    },
    recentActivity: recentActivity.slice(0, 10),
    stats
  };
}

async function saveDashboardData(data: DashboardData): Promise<void> {
  const dataPath = path.join(__dirname, '..', 'data', 'dashboard-data.json');
  await fs.promises.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.promises.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Dashboard data saved to ${dataPath}`);
}

async function main(): Promise<void> {
  console.log('🚀 Mission Control Usage Collector');
  console.log('=====================================\n');
  
  // Collect data
  console.log('📊 Collecting cron job statuses...');
  const crons = await collectCronJobs();
  console.log(`   Found ${crons.length} cron jobs`);
  
  console.log('📡 Collecting active sessions...');
  const sessions = await collectSessions();
  console.log(`   Found ${sessions.length} sessions`);
  
  // Build dashboard data
  console.log('\n🔧 Building dashboard data...');
  const dashboardData = await buildDashboardData(crons, sessions);
  
  // Save to file
  await saveDashboardData(dashboardData);
  
  // Summary
  console.log('\n📈 Summary:');
  console.log(`   Total crons: ${dashboardData.stats.totalCrons}`);
  console.log(`   Healthy: ${dashboardData.stats.healthyCrons}`);
  console.log(`   Errors: ${dashboardData.stats.errorCrons}`);
  console.log(`   Active sessions: ${dashboardData.stats.activeSessions}`);
  
  if (dashboardData.systemHealth.status !== 'healthy') {
    console.log(`\n⚠️  System status: ${dashboardData.systemHealth.status.toUpperCase()}`);
    for (const detail of dashboardData.systemHealth.details) {
      console.log(`   - ${detail}`);
    }
  } else {
    console.log('\n✅ System status: HEALTHY');
  }
}

main().catch(console.error);