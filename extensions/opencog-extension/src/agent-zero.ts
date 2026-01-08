/**
 * Agent-Zero Autonomous Orchestration Workbench
 * 
 * Inspired by agent-zero, this system provides autonomous agent orchestration
 * with dynamic task allocation, self-organization, and adaptive execution.
 */

import type { OrchestrationTask, OrchestrationPlan, OrchestrationContext } from '@janhq/core'
import type { TaskExecutionResult } from './task-executor'

/**
 * Agent-Zero configuration
 */
export interface AgentZeroConfig {
  maxAgents: number
  enableAutoSpawn: boolean
  enableSelfOptimization: boolean
  agentLifetimeMs: number
  taskQueueSize: number
  coordinationProtocol: 'centralized' | 'distributed' | 'hierarchical'
}

/**
 * Autonomous agent instance
 */
export interface AutonomousAgent {
  id: string
  type: 'coordinator' | 'specialist' | 'generalist' | 'researcher' | 'executor'
  status: 'idle' | 'active' | 'suspended' | 'terminated'
  capabilities: string[]
  currentTask: string | null
  taskHistory: AgentTaskRecord[]
  performance: AgentPerformanceMetrics
  createdAt: number
  lastActiveAt: number
  terminateAt?: number
}

/**
 * Agent task execution record
 */
export interface AgentTaskRecord {
  taskId: string
  taskName: string
  startedAt: number
  completedAt?: number
  result: 'success' | 'failure' | 'partial' | 'skipped'
  duration: number
  error?: string
}

/**
 * Agent performance metrics
 */
export interface AgentPerformanceMetrics {
  tasksCompleted: number
  tasksFailed: number
  totalExecutionTime: number
  averageExecutionTime: number
  successRate: number
  efficiency: number
  adaptability: number
}

/**
 * Agent communication message
 */
export interface AgentMessage {
  id: string
  from: string
  to: string | 'broadcast'
  type: 'task_request' | 'task_result' | 'status_update' | 'coordination' | 'help_request'
  payload: unknown
  priority: number
  timestamp: number
}

/**
 * Task allocation strategy
 */
export interface TaskAllocation {
  taskId: string
  agentId: string
  priority: number
  estimatedDuration: number
  confidence: number
}

/**
 * Workbench execution plan
 */
export interface WorkbenchPlan {
  id: string
  goal: string
  tasks: OrchestrationTask[]
  allocations: TaskAllocation[]
  agentIds: string[]
  status: 'planning' | 'executing' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
}

/**
 * Agent-Zero Orchestration Workbench
 * 
 * Provides:
 * - Autonomous agent spawning and lifecycle management
 * - Dynamic task allocation based on agent capabilities
 * - Self-organizing agent coordination
 * - Adaptive execution strategies
 * - Inter-agent communication and collaboration
 * - Performance-based agent optimization
 */
export class AgentZeroWorkbench {
  private config: AgentZeroConfig
  private agents: Map<string, AutonomousAgent> = new Map()
  private taskQueue: OrchestrationTask[] = []
  private messageQueue: AgentMessage[] = []
  private allocations: Map<string, TaskAllocation> = new Map()
  private workbenchPlans: Map<string, WorkbenchPlan> = new Map()
  private agentCounter = 0

  constructor(config: Partial<AgentZeroConfig> = {}) {
    this.config = {
      maxAgents: config.maxAgents || 10,
      enableAutoSpawn: config.enableAutoSpawn ?? true,
      enableSelfOptimization: config.enableSelfOptimization ?? true,
      agentLifetimeMs: config.agentLifetimeMs || 3600000, // 1 hour
      taskQueueSize: config.taskQueueSize || 100,
      coordinationProtocol: config.coordinationProtocol || 'hierarchical'
    }

    this.initializeWorkbench()
  }

  /**
   * Initialize workbench with core agents
   */
  private initializeWorkbench(): void {
    // Spawn initial coordinator agent
    this.spawnAgent('coordinator', ['coordinate', 'plan', 'monitor', 'optimize'])
    
    // Spawn initial specialist agents
    this.spawnAgent('researcher', ['research', 'analyze', 'gather_information'])
    this.spawnAgent('executor', ['execute', 'implement', 'deploy'])
  }

  /**
   * Spawn a new autonomous agent
   */
  spawnAgent(
    type: AutonomousAgent['type'],
    capabilities: string[]
  ): AutonomousAgent {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Maximum agent limit (${this.config.maxAgents}) reached`)
    }

    const agentId = `agent-${type}-${this.agentCounter++}`
    
    const agent: AutonomousAgent = {
      id: agentId,
      type,
      status: 'idle',
      capabilities,
      currentTask: null,
      taskHistory: [],
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successRate: 1.0,
        efficiency: 1.0,
        adaptability: 1.0
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      terminateAt: this.config.agentLifetimeMs > 0 
        ? Date.now() + this.config.agentLifetimeMs 
        : undefined
    }

    this.agents.set(agentId, agent)
    return agent
  }

  /**
   * Terminate an agent
   */
  terminateAgent(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    // Don't terminate if actively working
    if (agent.status === 'active' && agent.currentTask) {
      agent.status = 'suspended'
      agent.terminateAt = Date.now() + 60000 // Grace period
      return
    }

    agent.status = 'terminated'
    this.agents.delete(agentId)
  }

  /**
   * Create orchestration plan with autonomous agents
   */
  async createWorkbenchPlan(
    goal: string,
    tasks: OrchestrationTask[],
    context: OrchestrationContext
  ): Promise<WorkbenchPlan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Analyze required capabilities
    const requiredCapabilities = this.analyzeTaskCapabilities(tasks)

    // Ensure sufficient agents with required capabilities
    await this.ensureAgentCapabilities(requiredCapabilities)

    // Allocate tasks to agents
    const allocations = this.allocateTasks(tasks)

    const plan: WorkbenchPlan = {
      id: planId,
      goal,
      tasks,
      allocations,
      agentIds: Array.from(new Set(allocations.map(a => a.agentId))),
      status: 'planning',
      createdAt: Date.now()
    }

    this.workbenchPlans.set(planId, plan)
    return plan
  }

  /**
   * Execute workbench plan autonomously
   */
  async executeWorkbenchPlan(planId: string): Promise<WorkbenchPlan> {
    const plan = this.workbenchPlans.get(planId)
    if (!plan) {
      throw new Error(`Plan ${planId} not found`)
    }

    plan.status = 'executing'

    try {
      // Execute based on coordination protocol
      switch (this.config.coordinationProtocol) {
        case 'centralized':
          await this.executeCentralized(plan)
          break
        case 'distributed':
          await this.executeDistributed(plan)
          break
        case 'hierarchical':
          await this.executeHierarchical(plan)
          break
      }

      plan.status = 'completed'
      plan.completedAt = Date.now()
    } catch (error) {
      plan.status = 'failed'
      plan.completedAt = Date.now()
      throw error
    }

    return plan
  }

  /**
   * Execute plan with centralized coordination
   */
  private async executeCentralized(plan: WorkbenchPlan): Promise<void> {
    const coordinator = this.getAgentByType('coordinator')
    if (!coordinator) {
      throw new Error('No coordinator agent available')
    }

    // Coordinator orchestrates all tasks
    for (const allocation of plan.allocations) {
      const task = plan.tasks.find(t => t.id === allocation.taskId)
      if (!task) continue

      const agent = this.agents.get(allocation.agentId)
      if (!agent) continue

      await this.executeTask(agent, task)
    }
  }

  /**
   * Execute plan with distributed coordination
   */
  private async executeDistributed(plan: WorkbenchPlan): Promise<void> {
    // Agents self-organize and pick tasks
    const taskPromises = plan.allocations.map(allocation => {
      const task = plan.tasks.find(t => t.id === allocation.taskId)
      const agent = this.agents.get(allocation.agentId)
      
      if (!task || !agent) return Promise.resolve()
      
      return this.executeTask(agent, task)
    })

    await Promise.all(taskPromises)
  }

  /**
   * Execute plan with hierarchical coordination
   */
  private async executeHierarchical(plan: WorkbenchPlan): Promise<void> {
    const coordinator = this.getAgentByType('coordinator')
    if (!coordinator) {
      throw new Error('No coordinator agent available')
    }

    // Group tasks by dependencies and execute in waves
    const waves = this.groupTasksByDependencies(plan.tasks)

    for (const wave of waves) {
      const wavePromises = wave.map(async (task) => {
        const allocation = plan.allocations.find(a => a.taskId === task.id)
        if (!allocation) return

        const agent = this.agents.get(allocation.agentId)
        if (!agent) return

        await this.executeTask(agent, task)
      })

      await Promise.all(wavePromises)
    }
  }

  /**
   * Execute task with agent
   */
  private async executeTask(
    agent: AutonomousAgent,
    task: OrchestrationTask
  ): Promise<TaskExecutionResult> {
    agent.status = 'active'
    agent.currentTask = task.id
    agent.lastActiveAt = Date.now()

    const startTime = Date.now()
    let result: TaskExecutionResult

    try {
      // Simulate task execution with agent capabilities
      await this.simulateTaskExecution(task, agent)

      task.status = 'completed'
      const duration = Date.now() - startTime

      result = {
        success: true,
        taskId: task.id,
        result: { completed: true, agent: agent.id },
        duration
      }

      // Update agent performance
      this.updateAgentPerformance(agent, 'success', duration)
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : 'Unknown error'
      const duration = Date.now() - startTime

      result = {
        success: false,
        taskId: task.id,
        error: task.error,
        duration
      }

      this.updateAgentPerformance(agent, 'failure', duration)
    }

    // Record task in agent history
    agent.taskHistory.push({
      taskId: task.id,
      taskName: task.name,
      startedAt: startTime,
      completedAt: Date.now(),
      result: result.success ? 'success' : 'failure',
      duration: result.duration,
      error: result.error
    })

    agent.status = 'idle'
    agent.currentTask = null

    return result
  }

  /**
   * Simulate task execution
   */
  private async simulateTaskExecution(
    task: OrchestrationTask,
    agent: AutonomousAgent
  ): Promise<void> {
    // Simulate execution time based on agent efficiency
    const baseTime = 1000 // 1 second base
    const executionTime = baseTime / agent.performance.efficiency
    
    await new Promise(resolve => setTimeout(resolve, executionTime))
  }

  /**
   * Update agent performance metrics
   */
  private updateAgentPerformance(
    agent: AutonomousAgent,
    result: 'success' | 'failure',
    duration: number
  ): void {
    const perf = agent.performance

    if (result === 'success') {
      perf.tasksCompleted++
    } else {
      perf.tasksFailed++
    }

    perf.totalExecutionTime += duration
    const totalTasks = perf.tasksCompleted + perf.tasksFailed
    perf.averageExecutionTime = perf.totalExecutionTime / totalTasks
    perf.successRate = perf.tasksCompleted / totalTasks

    // Update efficiency based on execution time vs average
    if (perf.averageExecutionTime > 0) {
      perf.efficiency = Math.min(2.0, 
        perf.averageExecutionTime / duration
      )
    }

    // Adaptability increases with diverse tasks
    perf.adaptability = Math.min(2.0, 
      1.0 + (agent.taskHistory.length * 0.1)
    )
  }

  /**
   * Analyze required capabilities from tasks
   */
  private analyzeTaskCapabilities(tasks: OrchestrationTask[]): Set<string> {
    const capabilities = new Set<string>()

    for (const task of tasks) {
      // Extract capabilities from task description
      const desc = task.description.toLowerCase()
      
      if (desc.includes('research') || desc.includes('analyze')) {
        capabilities.add('research')
        capabilities.add('analyze')
      }
      if (desc.includes('write') || desc.includes('create')) {
        capabilities.add('create')
      }
      if (desc.includes('review') || desc.includes('validate')) {
        capabilities.add('validate')
      }
      if (desc.includes('execute') || desc.includes('implement')) {
        capabilities.add('execute')
      }
    }

    return capabilities
  }

  /**
   * Ensure agents with required capabilities exist
   */
  private async ensureAgentCapabilities(requiredCapabilities: Set<string>): Promise<void> {
    if (!this.config.enableAutoSpawn) return

    const existingCapabilities = new Set<string>()
    for (const agent of this.agents.values()) {
      agent.capabilities.forEach(cap => existingCapabilities.add(cap))
    }

    for (const capability of requiredCapabilities) {
      if (!existingCapabilities.has(capability) && this.agents.size < this.config.maxAgents) {
        // Spawn specialist agent for missing capability
        this.spawnAgent('specialist', [capability])
      }
    }
  }

  /**
   * Allocate tasks to agents based on capabilities and performance
   */
  private allocateTasks(tasks: OrchestrationTask[]): TaskAllocation[] {
    const allocations: TaskAllocation[] = []

    for (const task of tasks) {
      const allocation = this.findBestAgentForTask(task)
      if (allocation) {
        allocations.push(allocation)
        this.allocations.set(task.id, allocation)
      }
    }

    return allocations
  }

  /**
   * Find best agent for a task
   */
  private findBestAgentForTask(task: OrchestrationTask): TaskAllocation | null {
    let bestAgent: AutonomousAgent | null = null
    let bestScore = 0

    for (const agent of this.agents.values()) {
      if (agent.status === 'terminated') continue

      // Calculate match score based on capabilities and performance
      const capabilityMatch = this.calculateCapabilityMatch(task, agent)
      const performanceScore = agent.performance.successRate * agent.performance.efficiency
      const availabilityScore = agent.status === 'idle' ? 1.0 : 0.5

      const score = capabilityMatch * 0.5 + performanceScore * 0.3 + availabilityScore * 0.2

      if (score > bestScore) {
        bestScore = score
        bestAgent = agent
      }
    }

    if (!bestAgent) return null

    return {
      taskId: task.id,
      agentId: bestAgent.id,
      priority: 1,
      estimatedDuration: bestAgent.performance.averageExecutionTime || 1000,
      confidence: bestScore
    }
  }

  /**
   * Calculate capability match between task and agent
   */
  private calculateCapabilityMatch(task: OrchestrationTask, agent: AutonomousAgent): number {
    const taskDesc = task.description.toLowerCase()
    let matches = 0
    let total = agent.capabilities.length

    for (const capability of agent.capabilities) {
      if (taskDesc.includes(capability)) {
        matches++
      }
    }

    return total > 0 ? matches / total : 0
  }

  /**
   * Group tasks by dependencies into execution waves
   */
  private groupTasksByDependencies(tasks: OrchestrationTask[]): OrchestrationTask[][] {
    const waves: OrchestrationTask[][] = []
    const processed = new Set<string>()

    while (processed.size < tasks.length) {
      const wave: OrchestrationTask[] = []

      for (const task of tasks) {
        if (processed.has(task.id)) continue

        // Check if all dependencies are processed
        const dependencies = task.dependencies || []
        const allDepsProcessed = dependencies.every(dep => processed.has(dep))

        if (allDepsProcessed) {
          wave.push(task)
          processed.add(task.id)
        }
      }

      if (wave.length === 0 && processed.size < tasks.length) {
        // Circular dependency or orphaned tasks - add remaining
        const remaining = tasks.filter(t => !processed.has(t.id))
        wave.push(...remaining)
        remaining.forEach(t => processed.add(t.id))
      }

      if (wave.length > 0) {
        waves.push(wave)
      }
    }

    return waves
  }

  /**
   * Get agent by type
   */
  private getAgentByType(type: AutonomousAgent['type']): AutonomousAgent | undefined {
    return Array.from(this.agents.values()).find(agent => agent.type === type)
  }

  /**
   * Get workbench statistics
   */
  getWorkbenchStats() {
    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
      idleAgents: Array.from(this.agents.values()).filter(a => a.status === 'idle').length,
      totalPlans: this.workbenchPlans.size,
      activePlans: Array.from(this.workbenchPlans.values()).filter(p => p.status === 'executing').length,
      taskQueueSize: this.taskQueue.length,
      messageQueueSize: this.messageQueue.length,
      averageAgentPerformance: this.calculateAveragePerformance()
    }
  }

  /**
   * Calculate average performance across all agents
   */
  private calculateAveragePerformance(): AgentPerformanceMetrics {
    const agents = Array.from(this.agents.values())
    if (agents.length === 0) {
      return {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successRate: 0,
        efficiency: 0,
        adaptability: 0
      }
    }

    const sum = agents.reduce((acc, agent) => ({
      tasksCompleted: acc.tasksCompleted + agent.performance.tasksCompleted,
      tasksFailed: acc.tasksFailed + agent.performance.tasksFailed,
      totalExecutionTime: acc.totalExecutionTime + agent.performance.totalExecutionTime,
      averageExecutionTime: acc.averageExecutionTime + agent.performance.averageExecutionTime,
      successRate: acc.successRate + agent.performance.successRate,
      efficiency: acc.efficiency + agent.performance.efficiency,
      adaptability: acc.adaptability + agent.performance.adaptability
    }), {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successRate: 0,
      efficiency: 0,
      adaptability: 0
    })

    return {
      tasksCompleted: sum.tasksCompleted,
      tasksFailed: sum.tasksFailed,
      totalExecutionTime: sum.totalExecutionTime,
      averageExecutionTime: sum.averageExecutionTime / agents.length,
      successRate: sum.successRate / agents.length,
      efficiency: sum.efficiency / agents.length,
      adaptability: sum.adaptability / agents.length
    }
  }

  /**
   * List all agents
   */
  listAgents(): AutonomousAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AutonomousAgent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get plan by ID
   */
  getPlan(planId: string): WorkbenchPlan | undefined {
    return this.workbenchPlans.get(planId)
  }

  /**
   * List all plans
   */
  listPlans(): WorkbenchPlan[] {
    return Array.from(this.workbenchPlans.values())
  }

  /**
   * Optimize workbench by terminating underperforming agents
   */
  optimizeWorkbench(): void {
    if (!this.config.enableSelfOptimization) return

    const now = Date.now()

    for (const agent of this.agents.values()) {
      // Terminate expired agents
      if (agent.terminateAt && now >= agent.terminateAt && agent.status === 'idle') {
        this.terminateAgent(agent.id)
        continue
      }

      // Terminate underperforming agents
      if (agent.performance.successRate < 0.5 && agent.taskHistory.length > 5) {
        this.terminateAgent(agent.id)
      }
    }
  }
}

// Singleton instance
let agentZeroWorkbench: AgentZeroWorkbench | null = null

/**
 * Get singleton agent-zero workbench
 */
export function getAgentZeroWorkbench(): AgentZeroWorkbench {
  if (!agentZeroWorkbench) {
    agentZeroWorkbench = new AgentZeroWorkbench()
  }
  return agentZeroWorkbench
}

/**
 * Reset agent-zero workbench (for testing)
 */
export function resetAgentZeroWorkbench(): void {
  agentZeroWorkbench = null
}
