/**
 * Multi-Tenant Atomspace Fabric for OpenCog
 * 
 * Provides tenant-isolated atomspace instances with configurable sharing
 * and cross-tenant knowledge federation.
 */

import { Atomspace, type Atom, type Node, type Link, type AtomPattern } from './atomspace'
import { getTenantManager, type TenantConfig, type TenantMetrics } from './tenant-manager'
import type { OrchestrationContext } from '@janhq/core'

/**
 * Multi-tenant atomspace query result
 */
export interface MultiTenantQueryResult {
  tenantId: string
  atoms: Atom[]
  source: 'local' | 'shared' | 'federated'
}

/**
 * Cross-tenant knowledge sharing configuration
 */
export interface CrossTenantSharingConfig {
  enabled: boolean
  allowedTenants: string[]
  sharedNamespaces: string[]
  readOnly: boolean
}

/**
 * Multi-Tenant Atomspace Fabric
 * 
 * Manages tenant-isolated atomspace instances with:
 * - Per-tenant knowledge graphs
 * - Configurable knowledge sharing
 * - Resource isolation and quotas
 * - Cross-tenant query federation
 * - Tenant-aware inference
 */
export class MultiTenantAtomspaceFabric {
  private atomspaces: Map<string, Atomspace> = new Map()
  private sharingConfigs: Map<string, CrossTenantSharingConfig> = new Map()
  private tenantManager = getTenantManager()

  constructor() {
    // Initialize default tenant atomspace
    this.getOrCreateAtomspace(this.tenantManager.getDefaultTenantId())
  }

  /**
   * Get or create atomspace for a tenant
   */
  private getOrCreateAtomspace(tenantId: string): Atomspace {
    let atomspace = this.atomspaces.get(tenantId)
    
    if (!atomspace) {
      const tenant = this.tenantManager.getTenant(tenantId)
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`)
      }

      atomspace = new Atomspace()
      this.atomspaces.set(tenantId, atomspace)
      
      // Initialize sharing config
      this.initializeSharingConfig(tenantId, tenant)
    }

    return atomspace
  }

  /**
   * Initialize sharing configuration for tenant
   */
  private initializeSharingConfig(tenantId: string, tenant: TenantConfig): void {
    const isolation = this.tenantManager.getTenantIsolation(tenantId)
    
    this.sharingConfigs.set(tenantId, {
      enabled: tenant.sharedKnowledge,
      allowedTenants: tenant.isolationLevel === 'shared' ? [] : [], // Empty means all if enabled
      sharedNamespaces: isolation?.sharedConceptNamespaces || [],
      readOnly: tenant.isolationLevel !== 'shared'
    })
  }

  /**
   * Get atomspace for a specific tenant
   */
  getTenantAtomspace(tenantId: string): Atomspace {
    return this.getOrCreateAtomspace(tenantId)
  }

  /**
   * Get atomspace from orchestration context
   */
  getAtomspaceFromContext(context: OrchestrationContext): Atomspace {
    const tenantId = this.tenantManager.getTenantFromContext(context)
    return this.getTenantAtomspace(tenantId)
  }

  /**
   * Add a node to tenant's atomspace
   */
  addNode(tenantId: string, node: Node): Node {
    const atomspace = this.getTenantAtomspace(tenantId)
    
    // Check quota before adding
    if (!this.tenantManager.checkQuota(tenantId, 'maxAtoms', 1)) {
      throw new Error(`Tenant ${tenantId} has reached atom quota`)
    }

    const result = atomspace.addNode(node)
    
    // Update metrics
    this.tenantManager.updateMetrics(tenantId, {
      atomCount: atomspace.getAtomCount()
    })

    return result
  }

  /**
   * Add a link to tenant's atomspace
   */
  addLink(tenantId: string, link: Link): Link {
    const atomspace = this.getTenantAtomspace(tenantId)
    
    // Check quota before adding
    if (!this.tenantManager.checkQuota(tenantId, 'maxLinks', 1)) {
      throw new Error(`Tenant ${tenantId} has reached link quota`)
    }

    const result = atomspace.addLink(link)
    
    // Update metrics
    this.tenantManager.updateMetrics(tenantId, {
      linkCount: atomspace.getLinkCount()
    })

    return result
  }

  /**
   * Query tenant's atomspace with optional cross-tenant federation
   */
  query(
    tenantId: string,
    pattern: AtomPattern,
    options: { federateQuery?: boolean; maxTenants?: number } = {}
  ): MultiTenantQueryResult[] {
    const results: MultiTenantQueryResult[] = []
    
    // Query local tenant atomspace
    const localAtomspace = this.getTenantAtomspace(tenantId)
    const localAtoms = localAtomspace.query(pattern)
    
    results.push({
      tenantId,
      atoms: localAtoms,
      source: 'local'
    })

    // Update query metrics
    this.tenantManager.updateMetrics(tenantId, {
      queryCount: (this.tenantManager.getTenantMetrics(tenantId)?.queryCount || 0) + 1
    })

    // If federation is enabled, query shared namespaces from other tenants
    if (options.federateQuery) {
      const federatedResults = this.queryFederated(tenantId, pattern, options.maxTenants)
      results.push(...federatedResults)
    }

    return results
  }

  /**
   * Query across multiple tenants with federation
   */
  private queryFederated(
    sourceTenantId: string,
    pattern: AtomPattern,
    maxTenants?: number
  ): MultiTenantQueryResult[] {
    const results: MultiTenantQueryResult[] = []
    const sourceSharing = this.sharingConfigs.get(sourceTenantId)

    if (!sourceSharing?.enabled) {
      return results
    }

    let queriedCount = 0
    
    for (const [targetTenantId, targetAtomspace] of this.atomspaces.entries()) {
      // Skip source tenant
      if (targetTenantId === sourceTenantId) continue
      
      // Check if cross-tenant access is allowed
      if (!this.tenantManager.canAccessTenant(sourceTenantId, targetTenantId)) {
        continue
      }

      // Check max tenants limit
      if (maxTenants && queriedCount >= maxTenants) break

      // Get shared namespaces
      const sharedNamespaces = this.tenantManager.getSharedNamespaces(
        sourceTenantId,
        targetTenantId
      )

      if (sharedNamespaces.length === 0) continue

      // Query target atomspace with namespace filter
      const filteredPattern: AtomPattern = {
        ...pattern,
        // Filter by shared namespaces (if name pattern contains namespace)
      }

      const atoms = targetAtomspace.query(filteredPattern)
      
      // Filter atoms to only include those in shared namespaces
      const sharedAtoms = atoms.filter(atom => 
        this.isInSharedNamespace(atom, sharedNamespaces)
      )

      if (sharedAtoms.length > 0) {
        results.push({
          tenantId: targetTenantId,
          atoms: sharedAtoms,
          source: 'federated'
        })
        queriedCount++
      }
    }

    return results
  }

  /**
   * Check if atom is in shared namespace
   */
  private isInSharedNamespace(atom: Atom, namespaces: string[]): boolean {
    // Check if atom name starts with any shared namespace
    if ('name' in atom) {
      const name = atom.name as string
      return namespaces.some(ns => name.startsWith(`${ns}:`))
    }
    return false
  }

  /**
   * Find similar atoms across tenants
   */
  findSimilarAcrossTenants(
    tenantId: string,
    atom: Atom,
    minSimilarity: number,
    options: { includeFederated?: boolean } = {}
  ): Map<string, Atom[]> {
    const results = new Map<string, Atom[]>()
    
    // Search local tenant
    const localAtomspace = this.getTenantAtomspace(tenantId)
    const localSimilar = localAtomspace.findSimilarAtoms(atom, minSimilarity)
    results.set(tenantId, localSimilar)

    // Search federated tenants if enabled
    if (options.includeFederated) {
      for (const [otherTenantId, atomspace] of this.atomspaces.entries()) {
        if (otherTenantId === tenantId) continue
        
        if (!this.tenantManager.canAccessTenant(tenantId, otherTenantId)) {
          continue
        }

        const similar = atomspace.findSimilarAtoms(atom, minSimilarity)
        if (similar.length > 0) {
          results.set(otherTenantId, similar)
        }
      }
    }

    return results
  }

  /**
   * Share knowledge from one tenant to another
   */
  shareKnowledge(
    sourceTenantId: string,
    targetTenantId: string,
    atoms: Atom[],
    namespace: string
  ): void {
    // Verify sharing is allowed
    if (!this.tenantManager.canAccessTenant(sourceTenantId, targetTenantId)) {
      throw new Error(`Cross-tenant sharing not allowed between ${sourceTenantId} and ${targetTenantId}`)
    }

    const sharedNamespaces = this.tenantManager.getSharedNamespaces(sourceTenantId, targetTenantId)
    if (!sharedNamespaces.includes(namespace)) {
      throw new Error(`Namespace ${namespace} is not shared between tenants`)
    }

    const targetAtomspace = this.getTenantAtomspace(targetTenantId)
    const targetSharing = this.sharingConfigs.get(targetTenantId)

    if (targetSharing?.readOnly) {
      throw new Error(`Target tenant ${targetTenantId} is read-only for shared knowledge`)
    }

    // Copy atoms to target atomspace with namespace prefix
    for (const atom of atoms) {
      if ('name' in atom) {
        const namespacedAtom = {
          ...atom,
          name: `${namespace}:${atom.name}`
        }
        
        if ('type' in atom && atom.type.endsWith('Node')) {
          this.addNode(targetTenantId, namespacedAtom as Node)
        } else {
          this.addLink(targetTenantId, namespacedAtom as Link)
        }
      }
    }
  }

  /**
   * Get statistics for all tenants
   */
  getMultiTenantStats(): Array<{
    tenantId: string
    config: TenantConfig
    metrics: TenantMetrics
    atomspaceSize: number
  }> {
    const tenantsWithMetrics = this.tenantManager.getAllTenantsWithMetrics()
    
    return tenantsWithMetrics.map(({ config, metrics }) => ({
      tenantId: config.id,
      config,
      metrics,
      atomspaceSize: this.atomspaces.get(config.id)?.getAtomCount() || 0
    }))
  }

  /**
   * Delete tenant atomspace
   */
  deleteTenantAtomspace(tenantId: string): void {
    if (tenantId === this.tenantManager.getDefaultTenantId()) {
      throw new Error('Cannot delete default tenant atomspace')
    }

    this.atomspaces.delete(tenantId)
    this.sharingConfigs.delete(tenantId)
  }

  /**
   * Clear tenant atomspace
   */
  clearTenantAtomspace(tenantId: string): void {
    const atomspace = this.getTenantAtomspace(tenantId)
    // Reset atomspace by creating a new one
    this.atomspaces.set(tenantId, new Atomspace())
    
    // Reset metrics
    this.tenantManager.resetTenantMetrics(tenantId)
  }

  /**
   * Update cross-tenant sharing configuration
   */
  updateSharingConfig(tenantId: string, config: Partial<CrossTenantSharingConfig>): void {
    const existing = this.sharingConfigs.get(tenantId)
    if (!existing) {
      throw new Error(`No sharing config for tenant ${tenantId}`)
    }

    this.sharingConfigs.set(tenantId, {
      ...existing,
      ...config
    })
  }

  /**
   * Get sharing configuration for tenant
   */
  getSharingConfig(tenantId: string): CrossTenantSharingConfig | undefined {
    return this.sharingConfigs.get(tenantId)
  }

  /**
   * Export tenant knowledge graph
   */
  exportTenantKnowledge(tenantId: string): {
    tenantId: string
    atoms: Atom[]
    exportedAt: number
  } {
    const atomspace = this.getTenantAtomspace(tenantId)
    const atoms = atomspace.getAllAtoms()

    return {
      tenantId,
      atoms,
      exportedAt: Date.now()
    }
  }

  /**
   * Import knowledge into tenant atomspace
   */
  importTenantKnowledge(
    tenantId: string,
    data: { atoms: Atom[] },
    options: { mergeStrategy?: 'replace' | 'merge' } = {}
  ): void {
    const atomspace = this.getTenantAtomspace(tenantId)

    if (options.mergeStrategy === 'replace') {
      this.clearTenantAtomspace(tenantId)
    }

    // Import atoms
    for (const atom of data.atoms) {
      if ('type' in atom && atom.type.endsWith('Node')) {
        atomspace.addNode(atom as Node)
      } else {
        atomspace.addLink(atom as Link)
      }
    }

    // Update metrics
    this.tenantManager.updateMetrics(tenantId, {
      atomCount: atomspace.getAtomCount(),
      linkCount: atomspace.getLinkCount()
    })
  }

  /**
   * Get all tenant IDs
   */
  getAllTenantIds(): string[] {
    return Array.from(this.atomspaces.keys())
  }

  /**
   * Check if tenant atomspace exists
   */
  hasTenantAtomspace(tenantId: string): boolean {
    return this.atomspaces.has(tenantId)
  }
}

// Singleton instance
let multiTenantAtomspaceFabric: MultiTenantAtomspaceFabric | null = null

/**
 * Get the singleton multi-tenant atomspace fabric
 */
export function getMultiTenantAtomspaceFabric(): MultiTenantAtomspaceFabric {
  if (!multiTenantAtomspaceFabric) {
    multiTenantAtomspaceFabric = new MultiTenantAtomspaceFabric()
  }
  return multiTenantAtomspaceFabric
}

/**
 * Reset multi-tenant atomspace fabric (for testing)
 */
export function resetMultiTenantAtomspaceFabric(): void {
  multiTenantAtomspaceFabric = null
}
