/**
 * Multi-Assistant AI-Org Constellation System
 * 
 * Provides modular deployment and coordination of multiple assistant
 * organizations (constellations) with shared knowledge and resources.
 */

import type { OrchestrationContext } from '@janhq/core'
import { getTenantManager } from './tenant-manager'
import { getMultiTenantAtomspaceFabric } from './multi-tenant-atomspace'
import { getAgentZeroWorkbench, type AutonomousAgent } from './agent-zero'

/**
 * Assistant configuration in a constellation
 */
export interface AssistantConfig {
  id: string
  name: string
  role: 'primary' | 'specialist' | 'support' | 'advisor'
  capabilities: string[]
  model: string
  systemPrompt: string
  tools: string[]
  maxConcurrentTasks: number
  priority: number
}

/**
 * AI Organization (Constellation) configuration
 */
export interface AIOrganization {
  id: string
  name: string
  description: string
  tenantId: string
  assistants: AssistantConfig[]
  sharedKnowledge: boolean
  coordinationMode: 'collaborative' | 'hierarchical' | 'independent'
  status: 'active' | 'paused' | 'archived'
  createdAt: number
  updatedAt: number
  metadata: Record<string, unknown>
}

/**
 * Constellation deployment configuration
 */
export interface ConstellationDeployment {
  organizationId: string
  deploymentType: 'standalone' | 'federated' | 'hybrid'
  resourceAllocation: {
    maxMemoryMB: number
    maxConcurrentTasks: number
    maxAgents: number
  }
  networking: {
    allowExternalConnections: boolean
    allowedOrganizations: string[]
  }
}

/**
 * Inter-constellation message
 */
export interface ConstellationMessage {
  id: string
  fromOrgId: string
  toOrgId: string
  type: 'task_request' | 'knowledge_share' | 'resource_request' | 'coordination'
  payload: unknown
  priority: number
  timestamp: number
}

/**
 * Constellation task
 */
export interface ConstellationTask {
  id: string
  organizationId: string
  assignedAssistantId: string
  description: string
  status: 'pending' | 'executing' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
  result?: unknown
}

/**
 * Constellation coordination event
 */
export interface CoordinationEvent {
  id: string
  type: 'assistant_added' | 'assistant_removed' | 'task_delegated' | 'knowledge_shared' | 'org_connected'
  organizationId: string
  timestamp: number
  details: Record<string, unknown>
}

/**
 * Multi-Assistant Constellation Manager
 * 
 * Provides:
 * - Organization lifecycle management
 * - Assistant deployment and coordination
 * - Inter-constellation communication
 * - Shared knowledge management
 * - Resource allocation and monitoring
 * - Modular constellation deployment
 */
export class ConstellationManager {
  private organizations: Map<string, AIOrganization> = new Map()
  private deployments: Map<string, ConstellationDeployment> = new Map()
  private tasks: Map<string, ConstellationTask> = new Map()
  private messageQueue: ConstellationMessage[] = []
  private coordinationEvents: CoordinationEvent[] = []
  
  private tenantManager = getTenantManager()
  private atomspaceFabric = getMultiTenantAtomspaceFabric()
  private agentZeroWorkbench = getAgentZeroWorkbench()

  constructor() {
    this.initializeDefaultOrganization()
  }

  /**
   * Initialize default organization
   */
  private initializeDefaultOrganization(): void {
    const defaultOrg: AIOrganization = {
      id: 'default-org',
      name: 'Default Organization',
      description: 'Default multi-assistant organization',
      tenantId: this.tenantManager.getDefaultTenantId(),
      assistants: [
        {
          id: 'assistant-primary',
          name: 'Primary Assistant',
          role: 'primary',
          capabilities: ['general', 'coordination'],
          model: 'default',
          systemPrompt: 'You are a helpful AI assistant.',
          tools: [],
          maxConcurrentTasks: 5,
          priority: 1
        }
      ],
      sharedKnowledge: true,
      coordinationMode: 'collaborative',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    }

    this.organizations.set(defaultOrg.id, defaultOrg)
    this.createDeployment(defaultOrg.id, 'standalone')
  }

  /**
   * Create a new AI organization (constellation)
   */
  createOrganization(
    config: Omit<AIOrganization, 'createdAt' | 'updatedAt' | 'status'>
  ): AIOrganization {
    if (this.organizations.has(config.id)) {
      throw new Error(`Organization ${config.id} already exists`)
    }

    // Create tenant for organization
    const tenant = this.tenantManager.createTenant({
      id: config.tenantId,
      name: `Tenant for ${config.name}`,
      description: `Dedicated tenant for ${config.name} constellation`,
      maxAtoms: 100000,
      maxLinks: 500000,
      maxMemoryMB: 512,
      plnEnabled: true,
      toolsEnabled: true,
      sharedKnowledge: config.sharedKnowledge,
      isolationLevel: 'hybrid',
      metadata: { organizationId: config.id }
    })

    const organization: AIOrganization = {
      ...config,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.organizations.set(config.id, organization)

    // Record event
    this.recordEvent({
      id: `event-${Date.now()}`,
      type: 'org_connected',
      organizationId: config.id,
      timestamp: Date.now(),
      details: { action: 'created', tenantId: tenant.id }
    })

    return organization
  }

  /**
   * Get organization by ID
   */
  getOrganization(organizationId: string): AIOrganization | undefined {
    return this.organizations.get(organizationId)
  }

  /**
   * List all organizations
   */
  listOrganizations(filter?: { status?: AIOrganization['status'] }): AIOrganization[] {
    let orgs = Array.from(this.organizations.values())

    if (filter?.status) {
      orgs = orgs.filter(org => org.status === filter.status)
    }

    return orgs
  }

  /**
   * Update organization
   */
  updateOrganization(
    organizationId: string,
    updates: Partial<AIOrganization>
  ): AIOrganization {
    const org = this.organizations.get(organizationId)
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`)
    }

    const updated: AIOrganization = {
      ...org,
      ...updates,
      id: org.id,
      tenantId: org.tenantId,
      createdAt: org.createdAt,
      updatedAt: Date.now()
    }

    this.organizations.set(organizationId, updated)
    return updated
  }

  /**
   * Delete organization
   */
  deleteOrganization(organizationId: string): void {
    if (organizationId === 'default-org') {
      throw new Error('Cannot delete default organization')
    }

    const org = this.organizations.get(organizationId)
    if (!org) return

    // Clean up tenant
    this.tenantManager.deleteTenant(org.tenantId)
    
    // Clean up deployment
    this.deployments.delete(organizationId)
    
    // Remove organization
    this.organizations.delete(organizationId)
  }

  /**
   * Add assistant to organization
   */
  addAssistant(organizationId: string, assistant: AssistantConfig): AIOrganization {
    const org = this.organizations.get(organizationId)
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`)
    }

    // Check if assistant already exists
    if (org.assistants.some(a => a.id === assistant.id)) {
      throw new Error(`Assistant ${assistant.id} already exists in organization`)
    }

    org.assistants.push(assistant)
    org.updatedAt = Date.now()

    this.recordEvent({
      id: `event-${Date.now()}`,
      type: 'assistant_added',
      organizationId,
      timestamp: Date.now(),
      details: { assistantId: assistant.id, role: assistant.role }
    })

    return org
  }

  /**
   * Remove assistant from organization
   */
  removeAssistant(organizationId: string, assistantId: string): AIOrganization {
    const org = this.organizations.get(organizationId)
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`)
    }

    const index = org.assistants.findIndex(a => a.id === assistantId)
    if (index === -1) {
      throw new Error(`Assistant ${assistantId} not found in organization`)
    }

    org.assistants.splice(index, 1)
    org.updatedAt = Date.now()

    this.recordEvent({
      id: `event-${Date.now()}`,
      type: 'assistant_removed',
      organizationId,
      timestamp: Date.now(),
      details: { assistantId }
    })

    return org
  }

  /**
   * Get assistant by ID
   */
  getAssistant(organizationId: string, assistantId: string): AssistantConfig | undefined {
    const org = this.organizations.get(organizationId)
    if (!org) return undefined

    return org.assistants.find(a => a.id === assistantId)
  }

  /**
   * Create constellation deployment
   */
  createDeployment(
    organizationId: string,
    deploymentType: ConstellationDeployment['deploymentType']
  ): ConstellationDeployment {
    const org = this.organizations.get(organizationId)
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`)
    }

    const deployment: ConstellationDeployment = {
      organizationId,
      deploymentType,
      resourceAllocation: {
        maxMemoryMB: 1024,
        maxConcurrentTasks: 10,
        maxAgents: 20
      },
      networking: {
        allowExternalConnections: deploymentType !== 'standalone',
        allowedOrganizations: []
      }
    }

    this.deployments.set(organizationId, deployment)
    return deployment
  }

  /**
   * Update deployment configuration
   */
  updateDeployment(
    organizationId: string,
    updates: Partial<ConstellationDeployment>
  ): ConstellationDeployment {
    const deployment = this.deployments.get(organizationId)
    if (!deployment) {
      throw new Error(`Deployment for organization ${organizationId} not found`)
    }

    const updated: ConstellationDeployment = {
      ...deployment,
      ...updates,
      organizationId: deployment.organizationId
    }

    this.deployments.set(organizationId, updated)
    return updated
  }

  /**
   * Assign task to assistant in organization
   */
  async assignTask(
    organizationId: string,
    taskDescription: string,
    context: OrchestrationContext
  ): Promise<ConstellationTask> {
    const org = this.organizations.get(organizationId)
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`)
    }

    // Find best assistant for task
    const assistant = this.selectAssistantForTask(org, taskDescription)
    if (!assistant) {
      throw new Error('No suitable assistant found for task')
    }

    const task: ConstellationTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      assignedAssistantId: assistant.id,
      description: taskDescription,
      status: 'pending',
      createdAt: Date.now()
    }

    this.tasks.set(task.id, task)

    this.recordEvent({
      id: `event-${Date.now()}`,
      type: 'task_delegated',
      organizationId,
      timestamp: Date.now(),
      details: { taskId: task.id, assistantId: assistant.id }
    })

    return task
  }

  /**
   * Select best assistant for task
   */
  private selectAssistantForTask(
    org: AIOrganization,
    taskDescription: string
  ): AssistantConfig | null {
    const desc = taskDescription.toLowerCase()
    let bestAssistant: AssistantConfig | null = null
    let bestScore = 0

    for (const assistant of org.assistants) {
      let score = 0

      // Match capabilities
      for (const capability of assistant.capabilities) {
        if (desc.includes(capability)) {
          score += 2
        }
      }

      // Primary assistants get priority
      if (assistant.role === 'primary') {
        score += 1
      }

      // Priority bonus
      score += assistant.priority * 0.5

      if (score > bestScore) {
        bestScore = score
        bestAssistant = assistant
      }
    }

    return bestAssistant
  }

  /**
   * Share knowledge between organizations
   */
  async shareKnowledgeBetweenOrgs(
    sourceOrgId: string,
    targetOrgId: string,
    knowledgeType: string
  ): Promise<void> {
    const sourceOrg = this.organizations.get(sourceOrgId)
    const targetOrg = this.organizations.get(targetOrgId)

    if (!sourceOrg || !targetOrg) {
      throw new Error('Source or target organization not found')
    }

    // Check if sharing is allowed
    const sourceDeployment = this.deployments.get(sourceOrgId)
    if (sourceDeployment && !sourceDeployment.networking.allowExternalConnections) {
      throw new Error('Source organization does not allow external connections')
    }

    // Export knowledge from source tenant
    const knowledge = this.atomspaceFabric.exportTenantKnowledge(sourceOrg.tenantId)

    // Import to target tenant with shared namespace
    this.atomspaceFabric.shareKnowledge(
      sourceOrg.tenantId,
      targetOrg.tenantId,
      knowledge.atoms,
      'shared'
    )

    this.recordEvent({
      id: `event-${Date.now()}`,
      type: 'knowledge_shared',
      organizationId: sourceOrgId,
      timestamp: Date.now(),
      details: { targetOrgId, knowledgeType }
    })
  }

  /**
   * Connect organizations for inter-constellation communication
   */
  connectOrganizations(org1Id: string, org2Id: string): void {
    const deployment1 = this.deployments.get(org1Id)
    const deployment2 = this.deployments.get(org2Id)

    if (!deployment1 || !deployment2) {
      throw new Error('One or both organizations do not have deployments')
    }

    // Add to allowed organizations
    if (!deployment1.networking.allowedOrganizations.includes(org2Id)) {
      deployment1.networking.allowedOrganizations.push(org2Id)
    }
    if (!deployment2.networking.allowedOrganizations.includes(org1Id)) {
      deployment2.networking.allowedOrganizations.push(org1Id)
    }

    this.recordEvent({
      id: `event-${Date.now()}`,
      type: 'org_connected',
      organizationId: org1Id,
      timestamp: Date.now(),
      details: { connectedOrgId: org2Id }
    })
  }

  /**
   * Send message between organizations
   */
  sendMessage(message: Omit<ConstellationMessage, 'id' | 'timestamp'>): ConstellationMessage {
    const fullMessage: ConstellationMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    // Verify organizations are connected
    const deployment = this.deployments.get(message.fromOrgId)
    if (deployment && !deployment.networking.allowedOrganizations.includes(message.toOrgId)) {
      throw new Error('Organizations are not connected')
    }

    this.messageQueue.push(fullMessage)
    return fullMessage
  }

  /**
   * Get messages for organization
   */
  getMessagesForOrganization(organizationId: string): ConstellationMessage[] {
    return this.messageQueue.filter(msg => msg.toOrgId === organizationId)
  }

  /**
   * Get constellation statistics
   */
  getConstellationStats() {
    return {
      totalOrganizations: this.organizations.size,
      activeOrganizations: Array.from(this.organizations.values()).filter(
        org => org.status === 'active'
      ).length,
      totalAssistants: Array.from(this.organizations.values()).reduce(
        (sum, org) => sum + org.assistants.length,
        0
      ),
      totalTasks: this.tasks.size,
      activeTasks: Array.from(this.tasks.values()).filter(
        task => task.status === 'executing'
      ).length,
      messageQueueSize: this.messageQueue.length,
      coordinationEvents: this.coordinationEvents.length
    }
  }

  /**
   * Record coordination event
   */
  private recordEvent(event: CoordinationEvent): void {
    this.coordinationEvents.push(event)
    
    // Keep only last 1000 events
    if (this.coordinationEvents.length > 1000) {
      this.coordinationEvents = this.coordinationEvents.slice(-1000)
    }
  }

  /**
   * Get coordination events
   */
  getCoordinationEvents(
    organizationId?: string,
    limit = 100
  ): CoordinationEvent[] {
    let events = this.coordinationEvents

    if (organizationId) {
      events = events.filter(e => e.organizationId === organizationId)
    }

    return events.slice(-limit)
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ConstellationTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * List tasks for organization
   */
  listTasks(organizationId: string): ConstellationTask[] {
    return Array.from(this.tasks.values()).filter(
      task => task.organizationId === organizationId
    )
  }

  /**
   * Get deployment for organization
   */
  getDeployment(organizationId: string): ConstellationDeployment | undefined {
    return this.deployments.get(organizationId)
  }
}

// Singleton instance
let constellationManager: ConstellationManager | null = null

/**
 * Get singleton constellation manager
 */
export function getConstellationManager(): ConstellationManager {
  if (!constellationManager) {
    constellationManager = new ConstellationManager()
  }
  return constellationManager
}

/**
 * Reset constellation manager (for testing)
 */
export function resetConstellationManager(): void {
  constellationManager = null
}
