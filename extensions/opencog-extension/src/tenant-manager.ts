/**
 * Multi-Tenant Management System for OpenCog Atomspace
 * 
 * Provides tenant isolation, configuration, and resource management for the
 * neuro-symbolic atomspace fabric.
 */

import type { OrchestrationContext } from '@janhq/core'

/**
 * Tenant configuration
 */
export interface TenantConfig {
  id: string
  name: string
  description?: string
  maxAtoms: number
  maxLinks: number
  maxMemoryMB: number
  plnEnabled: boolean
  toolsEnabled: boolean
  sharedKnowledge: boolean
  isolationLevel: 'strict' | 'shared' | 'hybrid'
  createdAt: number
  updatedAt: number
  metadata: Record<string, unknown>
}

/**
 * Tenant resource usage metrics
 */
export interface TenantMetrics {
  tenantId: string
  atomCount: number
  linkCount: number
  memoryUsageMB: number
  queryCount: number
  inferenceCount: number
  lastActivityAt: number
}

/**
 * Tenant quota limits
 */
export interface TenantQuota {
  maxAtoms: number
  maxLinks: number
  maxMemoryMB: number
  maxQueriesPerMinute: number
  maxInferencesPerMinute: number
}

/**
 * Tenant isolation policy
 */
export interface TenantIsolation {
  level: 'strict' | 'shared' | 'hybrid'
  allowCrossTenantQueries: boolean
  allowCrossTenantInference: boolean
  sharedConceptNamespaces: string[]
}

/**
 * Tenant Manager - Handles multi-tenancy for atomspace fabric
 * 
 * Provides:
 * - Tenant lifecycle management (create, update, delete)
 * - Resource isolation and quotas
 * - Tenant-specific atomspace instances
 * - Cross-tenant knowledge sharing (configurable)
 * - Metrics and monitoring
 */
export class TenantManager {
  private tenants: Map<string, TenantConfig> = new Map()
  private metrics: Map<string, TenantMetrics> = new Map()
  private quotas: Map<string, TenantQuota> = new Map()
  private isolationPolicies: Map<string, TenantIsolation> = new Map()
  
  // Default tenant for backward compatibility
  private readonly DEFAULT_TENANT_ID = 'default'

  constructor() {
    this.initializeDefaultTenant()
  }

  /**
   * Initialize default tenant for backward compatibility
   */
  private initializeDefaultTenant(): void {
    const defaultConfig: TenantConfig = {
      id: this.DEFAULT_TENANT_ID,
      name: 'Default Tenant',
      description: 'Default tenant for single-tenant mode',
      maxAtoms: 100000,
      maxLinks: 500000,
      maxMemoryMB: 512,
      plnEnabled: true,
      toolsEnabled: true,
      sharedKnowledge: false,
      isolationLevel: 'strict',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    }

    this.tenants.set(this.DEFAULT_TENANT_ID, defaultConfig)
    this.initializeTenantMetrics(this.DEFAULT_TENANT_ID)
    this.initializeTenantQuota(this.DEFAULT_TENANT_ID, defaultConfig)
    this.initializeTenantIsolation(this.DEFAULT_TENANT_ID, defaultConfig)
  }

  /**
   * Create a new tenant
   */
  createTenant(config: Omit<TenantConfig, 'createdAt' | 'updatedAt'>): TenantConfig {
    if (this.tenants.has(config.id)) {
      throw new Error(`Tenant ${config.id} already exists`)
    }

    const tenantConfig: TenantConfig = {
      ...config,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.tenants.set(config.id, tenantConfig)
    this.initializeTenantMetrics(config.id)
    this.initializeTenantQuota(config.id, tenantConfig)
    this.initializeTenantIsolation(config.id, tenantConfig)

    return tenantConfig
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): TenantConfig | undefined {
    return this.tenants.get(tenantId)
  }

  /**
   * Get tenant from context (with fallback to default)
   */
  getTenantFromContext(context: OrchestrationContext): string {
    // Extract tenant ID from context metadata, thread ID, or use default
    if (context.metadata?.tenantId) {
      return context.metadata.tenantId as string
    }
    
    // Try to derive from thread ID (format: tenant-id:thread-id)
    if (context.threadId?.includes(':')) {
      const [tenantId] = context.threadId.split(':')
      if (this.tenants.has(tenantId)) {
        return tenantId
      }
    }
    
    return this.DEFAULT_TENANT_ID
  }

  /**
   * List all tenants
   */
  listTenants(): TenantConfig[] {
    return Array.from(this.tenants.values())
  }

  /**
   * Update tenant configuration
   */
  updateTenant(tenantId: string, updates: Partial<TenantConfig>): TenantConfig {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`)
    }

    const updatedTenant: TenantConfig = {
      ...tenant,
      ...updates,
      id: tenant.id, // Prevent ID change
      createdAt: tenant.createdAt,
      updatedAt: Date.now()
    }

    this.tenants.set(tenantId, updatedTenant)

    // Update dependent configs if limits changed
    if (updates.maxAtoms || updates.maxLinks || updates.maxMemoryMB) {
      this.initializeTenantQuota(tenantId, updatedTenant)
    }

    if (updates.isolationLevel || updates.sharedKnowledge) {
      this.initializeTenantIsolation(tenantId, updatedTenant)
    }

    return updatedTenant
  }

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): void {
    if (tenantId === this.DEFAULT_TENANT_ID) {
      throw new Error('Cannot delete default tenant')
    }

    this.tenants.delete(tenantId)
    this.metrics.delete(tenantId)
    this.quotas.delete(tenantId)
    this.isolationPolicies.delete(tenantId)
  }

  /**
   * Get tenant metrics
   */
  getTenantMetrics(tenantId: string): TenantMetrics | undefined {
    return this.metrics.get(tenantId)
  }

  /**
   * Update tenant metrics
   */
  updateMetrics(tenantId: string, updates: Partial<TenantMetrics>): void {
    const metrics = this.metrics.get(tenantId)
    if (!metrics) return

    const updated: TenantMetrics = {
      ...metrics,
      ...updates,
      tenantId: metrics.tenantId,
      lastActivityAt: Date.now()
    }

    this.metrics.set(tenantId, updated)
  }

  /**
   * Check if tenant is within quota
   */
  checkQuota(tenantId: string, resourceType: keyof TenantQuota, amount: number): boolean {
    const quota = this.quotas.get(tenantId)
    const metrics = this.metrics.get(tenantId)
    
    if (!quota || !metrics) return false

    switch (resourceType) {
      case 'maxAtoms':
        return metrics.atomCount + amount <= quota.maxAtoms
      case 'maxLinks':
        return metrics.linkCount + amount <= quota.maxLinks
      case 'maxMemoryMB':
        return metrics.memoryUsageMB + amount <= quota.maxMemoryMB
      case 'maxQueriesPerMinute':
      case 'maxInferencesPerMinute':
        // For rate limits, would need time-based tracking
        return true
      default:
        return false
    }
  }

  /**
   * Get tenant quota
   */
  getTenantQuota(tenantId: string): TenantQuota | undefined {
    return this.quotas.get(tenantId)
  }

  /**
   * Get tenant isolation policy
   */
  getTenantIsolation(tenantId: string): TenantIsolation | undefined {
    return this.isolationPolicies.get(tenantId)
  }

  /**
   * Check if cross-tenant operation is allowed
   */
  canAccessTenant(sourceTenantId: string, targetTenantId: string): boolean {
    if (sourceTenantId === targetTenantId) return true

    const sourceIsolation = this.isolationPolicies.get(sourceTenantId)
    const targetIsolation = this.isolationPolicies.get(targetTenantId)

    if (!sourceIsolation || !targetIsolation) return false

    // Strict isolation prevents cross-tenant access
    if (sourceIsolation.level === 'strict' || targetIsolation.level === 'strict') {
      return false
    }

    // Shared mode allows cross-tenant queries
    if (sourceIsolation.level === 'shared' && targetIsolation.level === 'shared') {
      return sourceIsolation.allowCrossTenantQueries && targetIsolation.allowCrossTenantQueries
    }

    // Hybrid mode - check specific permissions
    return sourceIsolation.level === 'hybrid' && targetIsolation.level === 'hybrid'
  }

  /**
   * Get shared concept namespaces between tenants
   */
  getSharedNamespaces(tenantId1: string, tenantId2: string): string[] {
    const isolation1 = this.isolationPolicies.get(tenantId1)
    const isolation2 = this.isolationPolicies.get(tenantId2)

    if (!isolation1 || !isolation2) return []

    // Find intersection of shared namespaces
    return isolation1.sharedConceptNamespaces.filter(ns => 
      isolation2.sharedConceptNamespaces.includes(ns)
    )
  }

  /**
   * Initialize tenant metrics
   */
  private initializeTenantMetrics(tenantId: string): void {
    this.metrics.set(tenantId, {
      tenantId,
      atomCount: 0,
      linkCount: 0,
      memoryUsageMB: 0,
      queryCount: 0,
      inferenceCount: 0,
      lastActivityAt: Date.now()
    })
  }

  /**
   * Initialize tenant quota
   */
  private initializeTenantQuota(tenantId: string, config: TenantConfig): void {
    this.quotas.set(tenantId, {
      maxAtoms: config.maxAtoms,
      maxLinks: config.maxLinks,
      maxMemoryMB: config.maxMemoryMB,
      maxQueriesPerMinute: 100,
      maxInferencesPerMinute: 50
    })
  }

  /**
   * Initialize tenant isolation policy
   */
  private initializeTenantIsolation(tenantId: string, config: TenantConfig): void {
    this.isolationPolicies.set(tenantId, {
      level: config.isolationLevel,
      allowCrossTenantQueries: config.sharedKnowledge && config.isolationLevel !== 'strict',
      allowCrossTenantInference: config.sharedKnowledge && config.isolationLevel === 'shared',
      sharedConceptNamespaces: config.sharedKnowledge ? ['common', 'public'] : []
    })
  }

  /**
   * Get all tenants with their metrics
   */
  getAllTenantsWithMetrics(): Array<{ config: TenantConfig; metrics: TenantMetrics }> {
    return Array.from(this.tenants.values()).map(config => ({
      config,
      metrics: this.metrics.get(config.id) || {
        tenantId: config.id,
        atomCount: 0,
        linkCount: 0,
        memoryUsageMB: 0,
        queryCount: 0,
        inferenceCount: 0,
        lastActivityAt: Date.now()
      }
    }))
  }

  /**
   * Reset metrics for a tenant
   */
  resetTenantMetrics(tenantId: string): void {
    this.initializeTenantMetrics(tenantId)
  }

  /**
   * Get default tenant ID
   */
  getDefaultTenantId(): string {
    return this.DEFAULT_TENANT_ID
  }
}

// Singleton instance
let tenantManager: TenantManager | null = null

/**
 * Get the singleton tenant manager instance
 */
export function getTenantManager(): TenantManager {
  if (!tenantManager) {
    tenantManager = new TenantManager()
  }
  return tenantManager
}

/**
 * Reset tenant manager (for testing)
 */
export function resetTenantManager(): void {
  tenantManager = null
}
