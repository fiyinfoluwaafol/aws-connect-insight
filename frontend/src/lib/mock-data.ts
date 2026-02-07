// Mock data for Amazon Connect Supervisor Insights

export interface Agent {
  id: string;
  name: string;
  team: string;
  hireDate: string;
  status: 'active' | 'away' | 'offline';
}

export interface Call {
  id: string;
  agentId: string;
  agentName: string;
  startedAt: string;
  durationSec: number;
  sentimentScore: number;
  sentimentLabel: 'positive' | 'neutral' | 'negative';
  topics: string[];
  resolved: boolean;
  csat: number | null;
  customerName: string;
}

export interface CallSummary {
  callId: string;
  summaryText: string;
  keyPhrases: string[];
  entities: string[];
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
}

export interface Alert {
  id: string;
  callId: string;
  createdAt: string;
  ruleId: string;
  ruleLabel: string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'closed';
  issue: string;
}

export interface DailyMetric {
  date: string;
  avgSentiment: number;
  callCount: number;
  avgDuration: number;
  negativePercent: number;
}

const agents: Agent[] = [
  { id: 'a1', name: 'Sarah Chen', team: 'Billing', hireDate: '2023-01-15', status: 'active' },
  { id: 'a2', name: 'Marcus Rodriguez', team: 'Technical', hireDate: '2022-08-20', status: 'active' },
  { id: 'a3', name: 'Emily Johnson', team: 'Sales', hireDate: '2023-03-10', status: 'active' },
  { id: 'a4', name: 'David Kim', team: 'Billing', hireDate: '2022-11-05', status: 'active' },
  { id: 'a5', name: 'Lisa Martinez', team: 'Technical', hireDate: '2023-05-12', status: 'away' },
  { id: 'a6', name: 'James Wilson', team: 'Sales', hireDate: '2022-06-30', status: 'active' },
  { id: 'a7', name: 'Rachel Brown', team: 'Returns', hireDate: '2023-02-18', status: 'active' },
  { id: 'a8', name: 'Michael Davis', team: 'Technical', hireDate: '2022-09-14', status: 'active' },
  { id: 'a9', name: 'Jennifer Garcia', team: 'Billing', hireDate: '2023-04-22', status: 'active' },
  { id: 'a10', name: 'Robert Taylor', team: 'Returns', hireDate: '2022-12-08', status: 'offline' },
  { id: 'a11', name: 'Amanda White', team: 'Sales', hireDate: '2023-06-01', status: 'active' },
  { id: 'a12', name: 'Christopher Lee', team: 'Technical', hireDate: '2022-07-19', status: 'active' },
];

const topics = ['billing', 'shipping', 'returns', 'technical-support', 'account-setup', 'upsell', 'cancellation', 'refund'];
const customerNames = ['John Smith', 'Mary Johnson', 'Robert Davis', 'Patricia Brown', 'Michael Wilson', 'Linda Martinez', 'William Anderson', 'Barbara Taylor', 'David Thomas', 'Elizabeth Moore'];

function generateSentimentScore(): number {
  // Normal distribution around 0.2 with negative tail
  const random = Math.random();
  if (random < 0.15) {
    // 15% negative
    return -(Math.random() * 0.8 + 0.2);
  } else if (random < 0.65) {
    // 50% neutral to slightly positive
    return Math.random() * 0.4 - 0.1;
  } else {
    // 35% positive
    return Math.random() * 0.6 + 0.4;
  }
}

function getSentimentLabel(score: number): 'positive' | 'neutral' | 'negative' {
  if (score < -0.2) return 'negative';
  if (score > 0.3) return 'positive';
  return 'neutral';
}

function generateCalls(count: number): Call[] {
  const calls: Call[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const startedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 24 * 60 * 60 * 1000);
    const sentimentScore = generateSentimentScore();
    const topicCount = Math.floor(Math.random() * 3) + 1;
    const selectedTopics = [...topics].sort(() => 0.5 - Math.random()).slice(0, topicCount);
    
    calls.push({
      id: `call-${i + 1}`,
      agentId: agent.id,
      agentName: agent.name,
      startedAt: startedAt.toISOString(),
      durationSec: Math.floor(Math.random() * 1200) + 180, // 3-23 minutes
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      sentimentLabel: getSentimentLabel(sentimentScore),
      topics: selectedTopics,
      resolved: Math.random() > 0.15,
      csat: Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 3 : null,
      customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
    });
  }
  
  return calls.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

const mockCalls = generateCalls(300);

function generateSummary(call: Call): CallSummary {
  const transcripts = {
    negative: [
      { speaker: 'Customer', text: "I've been waiting for my refund for three weeks now. This is completely unacceptable!", timestamp: '00:00:15' },
      { speaker: 'Agent', text: "I sincerely apologize for the delay. Let me look into your account right away.", timestamp: '00:00:28' },
      { speaker: 'Customer', text: "I've already called twice and nothing has been done. I want to speak to a supervisor.", timestamp: '00:00:45' },
      { speaker: 'Agent', text: "I understand your frustration. I'm pulling up your account now and I see the refund was processed but...", timestamp: '00:01:02' },
    ],
    positive: [
      { speaker: 'Customer', text: "Hi, I need help setting up my new account.", timestamp: '00:00:05' },
      { speaker: 'Agent', text: "I'd be happy to help you with that! Let's get you set up right away.", timestamp: '00:00:12' },
      { speaker: 'Customer', text: "Great, thank you. What information do you need from me?", timestamp: '00:00:20' },
      { speaker: 'Agent', text: "Just your email address and a preferred username. Then I'll walk you through the rest.", timestamp: '00:00:27' },
      { speaker: 'Customer', text: "Perfect, that was so easy. Thank you for your help!", timestamp: '00:03:15' },
    ],
    neutral: [
      { speaker: 'Customer', text: "I have a question about my recent order.", timestamp: '00:00:08' },
      { speaker: 'Agent', text: "Sure, I can help with that. Can I have your order number?", timestamp: '00:00:15' },
      { speaker: 'Customer', text: "It's order number 12345.", timestamp: '00:00:22' },
      { speaker: 'Agent', text: "Let me pull that up for you. I see it here - what's your question?", timestamp: '00:00:30' },
    ],
  };
  
  const summaries = {
    negative: `Customer called regarding delayed refund (order #${Math.floor(Math.random() * 90000) + 10000}). Multiple previous contacts with no resolution. Customer expressed frustration and requested supervisor escalation. Agent attempted to resolve but customer remained dissatisfied. Requires follow-up.`,
    positive: `Customer contacted for ${call.topics[0]} assistance. Agent provided clear, friendly guidance throughout the interaction. Customer expressed satisfaction with the service. Issue fully resolved within first contact.`,
    neutral: `Customer inquiry about ${call.topics[0]}. Agent provided requested information and answered questions. Standard service interaction with satisfactory outcome.`,
  };
  
  return {
    callId: call.id,
    summaryText: summaries[call.sentimentLabel],
    keyPhrases: call.topics.concat(['customer service', 'resolution', 'account']).slice(0, 5),
    entities: [call.customerName, call.agentName, 'Amazon Connect'],
    transcript: transcripts[call.sentimentLabel],
  };
}

function generateAlerts(): Alert[] {
  const negativeCalls = mockCalls.filter(c => c.sentimentScore < -0.5 || !c.resolved || c.topics.includes('refund') || c.topics.includes('cancellation'));
  
  return negativeCalls.slice(0, 25).map((call, idx) => ({
    id: `alert-${idx + 1}`,
    callId: call.id,
    createdAt: call.startedAt,
    ruleId: call.sentimentScore < -0.5 ? 'R1' : !call.resolved ? 'R3' : 'R2',
    ruleLabel: call.sentimentScore < -0.5 ? 'Negative Sentiment Detected' : !call.resolved ? 'Unresolved Long Call' : 'High-Risk Keyword',
    severity: call.sentimentScore < -0.7 ? 'high' : call.sentimentScore < -0.4 ? 'medium' : 'low',
    status: Math.random() > 0.4 ? 'open' : 'closed',
    issue: `${call.topics[0]} - ${call.sentimentLabel} sentiment`,
  }));
}

function generateDailyMetrics(): DailyMetric[] {
  const metrics: DailyMetric[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const dayCalls = mockCalls.filter(c => c.startedAt.startsWith(dateStr));
    
    if (dayCalls.length > 0) {
      const avgSentiment = dayCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / dayCalls.length;
      const avgDuration = dayCalls.reduce((sum, c) => sum + c.durationSec, 0) / dayCalls.length;
      const negativeCount = dayCalls.filter(c => c.sentimentLabel === 'negative').length;
      
      metrics.push({
        date: dateStr,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        callCount: dayCalls.length,
        avgDuration: Math.round(avgDuration),
        negativePercent: Math.round((negativeCount / dayCalls.length) * 100),
      });
    }
  }
  
  return metrics;
}

export const mockData = {
  agents,
  calls: mockCalls,
  alerts: generateAlerts(),
  dailyMetrics: generateDailyMetrics(),
  getSummary: (callId: string): CallSummary | undefined => {
    const call = mockCalls.find(c => c.id === callId);
    return call ? generateSummary(call) : undefined;
  },
  getCallsByAgent: (agentId: string) => mockCalls.filter(c => c.agentId === agentId),
  searchCalls: (query: {
    keyword?: string;
    agentId?: string;
    sentimentMin?: number;
    sentimentMax?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    return mockCalls.filter(call => {
      if (query.keyword) {
        const keyword = query.keyword.toLowerCase();
        if (!call.topics.some(t => t.includes(keyword)) && 
            !call.customerName.toLowerCase().includes(keyword) &&
            !call.agentName.toLowerCase().includes(keyword)) {
          return false;
        }
      }
      if (query.agentId && call.agentId !== query.agentId) return false;
      if (query.sentimentMin !== undefined && call.sentimentScore < query.sentimentMin) return false;
      if (query.sentimentMax !== undefined && call.sentimentScore > query.sentimentMax) return false;
      if (query.dateFrom && call.startedAt < query.dateFrom) return false;
      if (query.dateTo && call.startedAt > query.dateTo) return false;
      return true;
    });
  },
};
