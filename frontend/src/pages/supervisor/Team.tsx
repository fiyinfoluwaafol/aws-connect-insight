import { useState, useEffect } from 'react';
import { teamsApi, AgentInfo } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PageSkeleton } from '@/components/PageSkeleton';
import { pageShellClassName } from '@/lib/page-animation';

/**
 * Team Management Page for Supervisors
 *
 * Allows supervisors to:
 * - View current team members
 * - Add available agents to their team
 * - Remove agents from their team
 */
export default function Team() {
  const [members, setMembers] = useState<AgentInfo[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /**
   * Load team members and available agents from the API
   */
  const loadData = async () => {
    try {
      setLoading(true);
      const [membersResponse, availableResponse] = await Promise.all([
        teamsApi.getMembers(),
        teamsApi.getAvailableAgents(),
      ]);
      setMembers(membersResponse.members);
      setAvailableAgents(availableResponse.agents);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load team data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add an agent to the team
   */
  const handleAddAgent = async (agent: AgentInfo) => {
    try {
      setActionLoading(agent.id);
      await teamsApi.addMember({ agent_id: agent.id });

      toast({
        title: 'Agent Added',
        description: `${agent.first_name || agent.email} has been added to your team`,
      });

      // Refresh the data
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add agent',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Remove an agent from the team
   */
  const handleRemoveAgent = async (agent: AgentInfo) => {
    try {
      setActionLoading(agent.id);
      await teamsApi.removeMember(agent.id);

      toast({
        title: 'Agent Removed',
        description: `${agent.first_name || agent.email} has been removed from your team`,
      });

      // Refresh the data
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove agent',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Format agent name for display
   */
  const getAgentName = (agent: AgentInfo): string => {
    if (agent.first_name && agent.last_name) {
      return `${agent.first_name} ${agent.last_name}`;
    }
    if (agent.first_name) {
      return agent.first_name;
    }
    return agent.email;
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className={pageShellClassName()}>
        <PageHeader
          title="Team"
          description="Manage your team members and add available agents."
        />
        <PageSkeleton variant="list" />
      </div>
    );
  }

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title="Team"
        description="Manage your team members and add available agents."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Team Members */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Current Team</h3>
            <span className="ml-auto text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No team members yet</p>
              <p className="text-sm">Add agents from the available list</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{getAgentName(member)}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAgent(member)}
                    disabled={actionLoading === member.id}
                  >
                    {actionLoading === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Available Agents */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Available Agents</h3>
            <span className="ml-auto text-sm text-muted-foreground">
              {availableAgents.length} available
            </span>
          </div>

          {availableAgents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No available agents</p>
              <p className="text-sm">All agents are assigned to teams</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{getAgentName(agent)}</p>
                    <p className="text-sm text-muted-foreground">{agent.email}</p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAddAgent(agent)}
                    disabled={actionLoading === agent.id}
                  >
                    {actionLoading === agent.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
