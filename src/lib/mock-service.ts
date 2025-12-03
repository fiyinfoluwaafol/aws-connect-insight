import { mockData, Call, Alert, CallSummary } from './mock-data';
import { useAppStore } from '@/stores/app-store';
import jsPDF from 'jspdf';

export interface SearchParams {
  keyword?: string;
  agentId?: string;
  agentIds?: string[];
  sentimentMin?: number;
  sentimentMax?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  calls: Call[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const MockService = {
  async searchCalls(params: SearchParams): Promise<SearchResult> {
    await delay(200 + Math.random() * 200);
    
    const { page = 1, pageSize = 20 } = params;
    
    let filtered = mockData.calls.filter((call) => {
      if (params.keyword) {
        const keyword = params.keyword.toLowerCase();
        const summary = mockData.getSummary(call.id);
        const transcriptMatch = summary?.transcript.some((t) =>
          t.text.toLowerCase().includes(keyword)
        );
        const topicMatch = call.topics.some((t) => t.includes(keyword));
        const nameMatch =
          call.customerName.toLowerCase().includes(keyword) ||
          call.agentName.toLowerCase().includes(keyword);
        if (!transcriptMatch && !topicMatch && !nameMatch) return false;
      }
      
      if (params.agentId && call.agentId !== params.agentId) return false;
      if (params.agentIds?.length && !params.agentIds.includes(call.agentId)) return false;
      if (params.sentimentMin !== undefined && call.sentimentScore < params.sentimentMin) return false;
      if (params.sentimentMax !== undefined && call.sentimentScore > params.sentimentMax) return false;
      if (params.dateFrom && call.startedAt < params.dateFrom) return false;
      if (params.dateTo && call.startedAt > params.dateTo) return false;
      
      return true;
    });
    
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const calls = filtered.slice(start, start + pageSize);
    
    return { calls, total, page, pageSize, totalPages };
  },

  getCall(callId: string): Call | undefined {
    return mockData.calls.find((c) => c.id === callId);
  },

  getSummary(callId: string): CallSummary | undefined {
    return mockData.getSummary(callId);
  },

  listAlerts(filters?: {
    status?: 'open' | 'closed';
    severity?: 'high' | 'medium' | 'low';
    dateFrom?: string;
    dateTo?: string;
  }): Alert[] {
    const storeAlerts = useAppStore.getState().alerts;
    const alerts = storeAlerts.length > 0 ? storeAlerts : mockData.alerts;
    
    return alerts.filter((alert) => {
      if (filters?.status && alert.status !== filters.status) return false;
      if (filters?.severity && alert.severity !== filters.severity) return false;
      if (filters?.dateFrom && alert.createdAt < filters.dateFrom) return false;
      if (filters?.dateTo && alert.createdAt > filters.dateTo) return false;
      return true;
    });
  },

  mutateAlert(alertId: string, patch: Partial<Alert>): Alert | undefined {
    useAppStore.getState().updateAlert(alertId, patch);
    return useAppStore.getState().alerts.find((a) => a.id === alertId);
  },

  generateDailyBrief(date: string) {
    const calls = mockData.calls.filter((c) => c.startedAt.startsWith(date));
    const priorCalls = mockData.calls.filter((c) => {
      const callDate = new Date(c.startedAt);
      const targetDate = new Date(date);
      const daysDiff = (targetDate.getTime() - callDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 0 && daysDiff <= 7;
    });
    
    const avgSentiment = calls.length > 0
      ? calls.reduce((sum, c) => sum + c.sentimentScore, 0) / calls.length
      : 0;
    const priorAvgSentiment = priorCalls.length > 0
      ? priorCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / priorCalls.length
      : 0;
    
    const negativePercent = calls.length > 0
      ? (calls.filter((c) => c.sentimentLabel === 'negative').length / calls.length) * 100
      : 0;
    
    const topicCounts: Record<string, number> = {};
    calls.forEach((c) => c.topics.forEach((t) => {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }));
    const topIssues = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    
    const negativeCalls = calls.filter((c) => c.sentimentLabel === 'negative');
    const coachingOpportunities = negativeCalls.slice(0, 3).map((c) =>
      `${c.agentName}: ${c.topics[0]} call - improve empathy and resolution`
    );
    
    const positiveCalls = calls.filter((c) => c.sentimentLabel === 'positive' && c.resolved);
    const exemplarLinks = positiveCalls.slice(0, 3).map((c) => c.id);
    
    const brief = {
      date,
      content: {
        totalCalls: calls.length,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        negativePercent: Math.round(negativePercent),
        deltaVsPrior: Math.round((avgSentiment - priorAvgSentiment) * 100) / 100,
        topIssues,
        coachingOpportunities,
        exemplarLinks,
      },
    };
    
    useAppStore.getState().addDailyBrief(brief);
    return brief;
  },

  exportCSV(data: any[], filename: string) {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const val = row[h];
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      ),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  async exportPDF(htmlContent: string, filename: string) {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(20);
    pdf.text('Daily Brief Report', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    const lines = htmlContent.split('\n');
    let y = 40;
    
    lines.forEach((line) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 10, y);
      y += 7;
    });
    
    pdf.save(`${filename}.pdf`);
  },

  sendEmailMock(to: string, subject: string, body: string) {
    useAppStore.getState().addSentEmail({ to, subject, body });
    return { success: true, message: `Email queued to ${to}` };
  },

  generatePostCallTips(call: Call): { tips: string[]; reason: string } {
    const tips: string[] = [];
    const reasons: string[] = [];
    
    if (call.sentimentScore < -0.3) {
      tips.push('Try acknowledging the customer\'s frustration earlier in the call');
      reasons.push('negative sentiment detected');
    }
    
    if (call.durationSec > 900) {
      tips.push('Consider summarizing the issue earlier to reduce call duration');
      reasons.push('long call duration');
    }
    
    if (!call.resolved) {
      tips.push('Ensure clear next steps are communicated before ending the call');
      reasons.push('call not resolved');
    }
    
    if (call.topics.includes('refund') || call.topics.includes('cancellation')) {
      tips.push('For retention calls, try offering alternatives before processing cancellation');
      reasons.push('retention opportunity');
    }
    
    if (tips.length === 0) {
      tips.push('Great job! Continue maintaining your positive interaction style');
    }
    
    return {
      tips: tips.slice(0, 3),
      reason: reasons.length > 0 ? `Based on: ${reasons.join(', ')}` : 'Based on call analysis',
    };
  },

  getAgentPerformance(agentId: string) {
    const agentCalls = mockData.calls.filter((c) => c.agentId === agentId);
    const last7Days = agentCalls.filter((c) => {
      const diff = Date.now() - new Date(c.startedAt).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    });
    
    const avgSentiment = last7Days.length > 0
      ? last7Days.reduce((sum, c) => sum + c.sentimentScore, 0) / last7Days.length
      : 0;
    
    // Generate fake percentile based on agent performance
    const percentile = Math.min(95, Math.max(25, 50 + avgSentiment * 40));
    
    const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];
      const dayCalls = agentCalls.filter((c) => c.startedAt.startsWith(dateStr));
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sentiment: dayCalls.length > 0
          ? dayCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / dayCalls.length
          : 0,
        calls: dayCalls.length,
      };
    });
    
    return {
      totalCalls: last7Days.length,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      percentile: Math.round(percentile),
      weeklyTrend,
    };
  },

  getExemplars(filters?: { topic?: string; minSentiment?: number }) {
    const exemplarIds = useAppStore.getState().exemplarCallIds;
    const defaultExemplars = mockData.calls
      .filter((c) => c.sentimentLabel === 'positive' && c.resolved)
      .slice(0, 8)
      .map((c) => c.id);
    
    const allExemplarIds = [...new Set([...exemplarIds, ...defaultExemplars])];
    
    return allExemplarIds
      .map((id) => mockData.calls.find((c) => c.id === id))
      .filter((c): c is Call => {
        if (!c) return false;
        if (filters?.topic && !c.topics.includes(filters.topic)) return false;
        if (filters?.minSentiment !== undefined && c.sentimentScore < filters.minSentiment) return false;
        return true;
      });
  },
};
