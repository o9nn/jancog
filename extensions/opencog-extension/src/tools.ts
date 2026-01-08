import { MCPTool } from '@janhq/core'

// v2.0 Tool names
export const CREATE_PLAN = 'create_orchestration_plan'
export const EXECUTE_PLAN = 'execute_orchestration_plan'
export const GET_PLAN = 'get_orchestration_plan'
export const LIST_PLANS = 'list_orchestration_plans'
export const CANCEL_PLAN = 'cancel_orchestration_plan'
export const ANALYZE_GOAL = 'analyze_goal'
export const REASON_ABOUT_TASK = 'reason_about_task'

// v3.0 Tool names - Atomspace, PLN, and Tool Integration
export const QUERY_KNOWLEDGE = 'query_knowledge'
export const INFER_KNOWLEDGE = 'infer_knowledge'
export const EXECUTE_TOOL = 'execute_tool'
export const GET_KNOWLEDGE_STATS = 'get_knowledge_stats'

// v4.0 Tool names - Multi-Tenancy, Agent-Zero, and Constellations
export const CREATE_TENANT = 'create_tenant'
export const MANAGE_TENANT = 'manage_tenant'
export const QUERY_MULTI_TENANT = 'query_multi_tenant'
export const SPAWN_AGENT_ZERO = 'spawn_agent_zero'
export const EXECUTE_AGENT_ZERO_PLAN = 'execute_agent_zero_plan'
export const CREATE_CONSTELLATION = 'create_constellation'
export const MANAGE_CONSTELLATION = 'manage_constellation'
export const SHARE_CONSTELLATION_KNOWLEDGE = 'share_constellation_knowledge'

export const OPENCOG_INTERNAL_SERVER = 'opencog-internal'

export function getOpenCogTools(): MCPTool[] {
  return [
    {
      name: CREATE_PLAN,
      description: 
        'Create an autonomous orchestration plan to achieve a high-level goal. The system will analyze the goal, break it down into tasks, and create an execution plan using cognitive reasoning.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { 
            type: 'string', 
            description: 'The high-level goal to achieve (e.g., "Research and write a report on renewable energy")' 
          },
          context: {
            type: 'object',
            description: 'Optional context information',
            properties: {
              threadId: { type: 'string', description: 'Thread ID for context' },
              availableTools: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'List of available tools that can be used'
              },
              modelId: { type: 'string', description: 'Model to use for reasoning' }
            }
          }
        },
        required: ['goal'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: EXECUTE_PLAN,
      description:
        'Execute a previously created orchestration plan. The system will autonomously execute each task in the plan, adapting as needed based on intermediate results.',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'The ID of the plan to execute' },
        },
        required: ['plan_id'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: GET_PLAN,
      description:
        'Get the current status and details of an orchestration plan.',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'The ID of the plan to retrieve' },
        },
        required: ['plan_id'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: LIST_PLANS,
      description:
        'List all orchestration plans (active and completed).',
      inputSchema: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['all', 'planning', 'executing', 'completed', 'failed'],
            description: 'Filter plans by status',
            default: 'all'
          },
        },
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: CANCEL_PLAN,
      description:
        'Cancel a running orchestration plan.',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'The ID of the plan to cancel' },
        },
        required: ['plan_id'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: ANALYZE_GOAL,
      description:
        'Use cognitive reasoning to analyze a goal and provide insights about complexity, feasibility, and required resources.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The goal to analyze' },
        },
        required: ['goal'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: REASON_ABOUT_TASK,
      description:
        'Apply cognitive reasoning to understand task requirements, dependencies, and optimal execution strategies.',
      inputSchema: {
        type: 'object',
        properties: {
          task_description: { type: 'string', description: 'The task to reason about' },
          context: {
            type: 'object',
            description: 'Optional context for reasoning',
          }
        },
        required: ['task_description'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    // v3.0 Tools - Atomspace, PLN, and Tool Integration
    {
      name: QUERY_KNOWLEDGE,
      description:
        'Query the Atomspace knowledge graph for stored knowledge about goals, tasks, concepts, and relationships. Find similar goals, retrieve task patterns, and explore the knowledge graph.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['GoalNode', 'TaskNode', 'PlanNode', 'ConceptNode', 'ToolNode', 'InheritanceLink', 'SimilarityLink'],
            description: 'Type of atom to search for'
          },
          name: { type: 'string', description: 'Name pattern to match (supports regex)' },
          min_confidence: { type: 'number', description: 'Minimum confidence threshold (0.0 to 1.0)' },
          min_strength: { type: 'number', description: 'Minimum truth value strength (0.0 to 1.0)' },
          limit: { type: 'number', description: 'Maximum number of results to return' },
          find_similar: { type: 'boolean', description: 'Find similar goals based on shared concepts' },
          goal: { type: 'string', description: 'Goal text to find similar goals for (requires find_similar=true)' },
        },
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: INFER_KNOWLEDGE,
      description:
        'Use PLN (Probabilistic Logic Networks) to derive new knowledge through logical inference. Supports forward chaining (derive new facts), backward chaining (prove goals), and task success prediction.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['forward', 'backward', 'task_success'],
            description: 'Inference mode: forward=derive new knowledge, backward=prove goal, task_success=predict likelihood'
          },
          target_atom_id: { type: 'string', description: 'Target atom ID for backward chaining' },
          task_description: { type: 'string', description: 'Task description for task_success mode' },
          max_iterations: { type: 'number', description: 'Maximum inference iterations' },
          min_confidence: { type: 'number', description: 'Minimum confidence for inferences' },
          max_new_atoms: { type: 'number', description: 'Maximum new atoms to create' },
          max_depth: { type: 'number', description: 'Maximum depth for backward chaining' },
          max_paths: { type: 'number', description: 'Maximum proof paths to explore' },
          focus_atoms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Atom IDs to focus inference on'
          },
          context: { type: 'object', description: 'Additional context for inference' },
        },
        required: ['mode'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: EXECUTE_TOOL,
      description:
        'Execute an integrated tool (RAG retrieval, file operations, web search, LLM inference, code analysis). Use tool chains for complex multi-step operations.',
      inputSchema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'Tool to execute: rag_retrieve, file_read, file_write, web_search, llm_inference, code_analysis, data_transform, summarize'
          },
          args: {
            type: 'object',
            description: 'Arguments for the tool (varies by tool type)',
          },
          chain: { type: 'boolean', description: 'If true, treat tool_name as a chain name' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['tool_name'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: GET_KNOWLEDGE_STATS,
      description:
        'Get statistics about the OpenCog knowledge system including Atomspace size, PLN inference history, tool execution stats, and plan metrics.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    // v4.0 Tools - Multi-Tenancy, Agent-Zero, and Constellations
    {
      name: CREATE_TENANT,
      description:
        'Create a new tenant with isolated atomspace for multi-tenant deployment. Each tenant gets dedicated knowledge graph and resource quotas.',
      inputSchema: {
        type: 'object',
        properties: {
          tenant_id: { type: 'string', description: 'Unique tenant identifier' },
          name: { type: 'string', description: 'Tenant display name' },
          description: { type: 'string', description: 'Tenant description' },
          max_atoms: { type: 'number', description: 'Maximum atoms allowed', default: 100000 },
          max_links: { type: 'number', description: 'Maximum links allowed', default: 500000 },
          max_memory_mb: { type: 'number', description: 'Maximum memory in MB', default: 512 },
          isolation_level: { 
            type: 'string', 
            enum: ['strict', 'shared', 'hybrid'],
            description: 'Tenant isolation level',
            default: 'hybrid'
          },
          shared_knowledge: { type: 'boolean', description: 'Enable cross-tenant knowledge sharing', default: false },
        },
        required: ['tenant_id', 'name'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: MANAGE_TENANT,
      description:
        'Manage tenant configuration, quotas, and isolation policies. Actions: get, update, delete, list.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get', 'update', 'delete', 'list', 'stats'],
            description: 'Management action to perform'
          },
          tenant_id: { type: 'string', description: 'Tenant ID for get/update/delete actions' },
          updates: { type: 'object', description: 'Updates for update action' },
        },
        required: ['action'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: QUERY_MULTI_TENANT,
      description:
        'Query across multiple tenant atomspaces with federation. Can search local tenant or federate across shared namespaces.',
      inputSchema: {
        type: 'object',
        properties: {
          tenant_id: { type: 'string', description: 'Source tenant ID' },
          pattern: { type: 'object', description: 'Atom pattern to search for' },
          federate: { type: 'boolean', description: 'Enable cross-tenant federation', default: false },
          max_tenants: { type: 'number', description: 'Maximum tenants to query', default: 5 },
        },
        required: ['tenant_id', 'pattern'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: SPAWN_AGENT_ZERO,
      description:
        'Spawn autonomous agent-zero agents with specific capabilities. Agents self-organize and execute tasks autonomously.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_type: {
            type: 'string',
            enum: ['coordinator', 'specialist', 'generalist', 'researcher', 'executor'],
            description: 'Type of agent to spawn'
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Agent capabilities (e.g., research, analyze, create, execute)'
          },
        },
        required: ['agent_type', 'capabilities'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: EXECUTE_AGENT_ZERO_PLAN,
      description:
        'Execute orchestration plan using agent-zero autonomous workbench. Agents self-organize, dynamically allocate tasks, and execute in parallel.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'High-level goal to achieve' },
          tasks: {
            type: 'array',
            items: { type: 'object' },
            description: 'Tasks to execute (optional, will be generated if not provided)'
          },
          coordination_mode: {
            type: 'string',
            enum: ['centralized', 'distributed', 'hierarchical'],
            description: 'Agent coordination protocol',
            default: 'hierarchical'
          },
          context: { type: 'object', description: 'Execution context' },
        },
        required: ['goal'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: CREATE_CONSTELLATION,
      description:
        'Create a new AI organization (constellation) with multiple specialized assistants. Enables modular deployment of multi-assistant systems.',
      inputSchema: {
        type: 'object',
        properties: {
          org_id: { type: 'string', description: 'Organization identifier' },
          name: { type: 'string', description: 'Organization name' },
          description: { type: 'string', description: 'Organization description' },
          tenant_id: { type: 'string', description: 'Dedicated tenant ID for this constellation' },
          assistants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string', enum: ['primary', 'specialist', 'support', 'advisor'] },
                capabilities: { type: 'array', items: { type: 'string' } },
                model: { type: 'string' },
                system_prompt: { type: 'string' },
              }
            },
            description: 'Assistant configurations'
          },
          coordination_mode: {
            type: 'string',
            enum: ['collaborative', 'hierarchical', 'independent'],
            description: 'How assistants coordinate',
            default: 'collaborative'
          },
          shared_knowledge: { type: 'boolean', description: 'Enable shared knowledge across assistants', default: true },
        },
        required: ['org_id', 'name', 'tenant_id', 'assistants'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: MANAGE_CONSTELLATION,
      description:
        'Manage AI organization constellations. Actions: get, update, delete, list, add_assistant, remove_assistant, assign_task.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get', 'update', 'delete', 'list', 'add_assistant', 'remove_assistant', 'assign_task', 'stats'],
            description: 'Management action'
          },
          org_id: { type: 'string', description: 'Organization ID' },
          assistant_id: { type: 'string', description: 'Assistant ID for add/remove actions' },
          assistant_config: { type: 'object', description: 'Assistant configuration for add action' },
          task_description: { type: 'string', description: 'Task description for assign_task action' },
          updates: { type: 'object', description: 'Updates for update action' },
        },
        required: ['action'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: SHARE_CONSTELLATION_KNOWLEDGE,
      description:
        'Share knowledge between AI organization constellations. Enables federation and collaboration across different AI-orgs.',
      inputSchema: {
        type: 'object',
        properties: {
          source_org_id: { type: 'string', description: 'Source organization ID' },
          target_org_id: { type: 'string', description: 'Target organization ID' },
          knowledge_type: { type: 'string', description: 'Type of knowledge to share' },
          connect_orgs: { type: 'boolean', description: 'Establish permanent connection between orgs', default: false },
        },
        required: ['source_org_id', 'target_org_id', 'knowledge_type'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
  ]
}
