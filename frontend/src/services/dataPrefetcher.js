/**
 * Controlled Concurrency Data Prefetcher
 * Warm-starts client cache on initial load without blocking UI or overloading backend
 */

import { cacheClient } from './cacheClient';
import { reportService, vendorService, taskService, managerService, agentService } from './api';

class DataPrefetcher {
  constructor() {
    this.isPrefetching = false;
    this.prefetchedUsers = new Set();
    this.concurrencyLimit = 2; // Maximum 2 concurrent requests
  }

  async runQueue(tasks) {
    const results = [];
    const executing = [];

    for (const task of tasks) {
      const p = Promise.resolve().then(() => task());
      results.push(p);

      if (this.concurrencyLimit <= tasks.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= this.concurrencyLimit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.allSettled(results);
  }

  async prefetchForUser(user) {
    if (!user) return;
    const userId = user.id || user._id;
    if (!userId) return;

    if (this.prefetchedUsers.has(userId)) {
      return; // Already prefetched for this user session
    }

    this.prefetchedUsers.add(userId);
    cacheClient.setCurrentUser(user);

    // Yield main thread so initial dashboard paint occurs smoothly first
    await new Promise(r => setTimeout(r, 200));

    const prefetchTasks = [
      // 1. Dashboard stats (highest priority)
      async () => {
        try {
          await cacheClient.fetchWithCache('dashboard:stats', () => reportService.getDashboardStats());
        } catch (e) {}
      },

      // 2. Leaderboard data
      async () => {
        try {
          await cacheClient.fetchWithCache('leaderboard', () => reportService.getLeaderboardData());
        } catch (e) {}
      },

      // 3. Primary Vendors list (page 1)
      async () => {
        try {
          const params = { page: 1, limit: 10 };
          const key = `vendors:list:p1:${JSON.stringify(params)}`;
          await cacheClient.fetchWithCache(key, () => vendorService.getVendors(params));
        } catch (e) {}
      },

      // 4. Tasks list
      async () => {
        try {
          const key = `tasks:all:${userId}`;
          await cacheClient.fetchWithCache(key, () => taskService.getTasks({}, user));
        } catch (e) {}
      },

      // 5. Manager Directory
      async () => {
        try {
          const key = `managers:directory:${userId}`;
          await cacheClient.fetchWithCache(key, () => managerService.getManagerDirectory({}, user));
        } catch (e) {}
      },

      // 6. Agent Directory
      async () => {
        try {
          const key = `agents:directory:${userId}`;
          await cacheClient.fetchWithCache(key, () => agentService.getAgents({}, user));
        } catch (e) {}
      }
    ];

    try {
      this.isPrefetching = true;
      console.log('🚀 [DataPrefetcher] Initiating background prefetch with controlled concurrency...');
      await this.runQueue(prefetchTasks);
      console.log('✅ [DataPrefetcher] Essential tab data prefetched into cache.');
    } catch (err) {
      console.warn('[DataPrefetcher] Prefetch error:', err);
    } finally {
      this.isPrefetching = false;
    }
  }

  reset() {
    this.prefetchedUsers.clear();
    this.isPrefetching = false;
  }
}

export const dataPrefetcher = new DataPrefetcher();
