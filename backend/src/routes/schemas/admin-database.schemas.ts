export const adminDatabaseTableOverviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'estimatedRows',
    'deadRows',
    'tableSizeBytes',
    'indexSizeBytes',
    'totalSizeBytes',
    'indexCount',
    'invalidIndexCount',
    'lastVacuumAt',
    'lastAutovacuumAt',
    'lastAnalyzeAt',
    'lastAutoanalyzeAt',
  ],
  properties: {
    name: {
      type: 'string',
    },
    estimatedRows: {
      type: 'number',
    },
    deadRows: {
      type: 'number',
    },
    tableSizeBytes: {
      type: 'number',
    },
    indexSizeBytes: {
      type: 'number',
    },
    totalSizeBytes: {
      type: 'number',
    },
    indexCount: {
      type: 'number',
    },
    invalidIndexCount: {
      type: 'number',
    },
    lastVacuumAt: {
      type: ['string', 'null'],
    },
    lastAutovacuumAt: {
      type: ['string', 'null'],
    },
    lastAnalyzeAt: {
      type: ['string', 'null'],
    },
    lastAutoanalyzeAt: {
      type: ['string', 'null'],
    },
  },
} as const;
export const adminDatabaseRelationshipSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    constraintName: {
      type: 'string',
    },
    sourceTable: {
      type: 'string',
    },
    sourceColumns: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    targetTable: {
      type: 'string',
    },
    targetColumns: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    onUpdate: {
      type: 'string',
      enum: ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'],
    },
    onDelete: {
      type: 'string',
      enum: ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'],
    },
  },
  required: [
    'constraintName',
    'sourceTable',
    'sourceColumns',
    'targetTable',
    'targetColumns',
    'onUpdate',
    'onDelete',
  ],
} as const;
export const adminDatabaseOverviewResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['database', 'totals', 'tables', 'relationships'],
  properties: {
    database: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'serverVersion', 'sizeBytes'],
      properties: {
        name: {
          type: 'string',
        },
        serverVersion: {
          type: 'string',
        },
        sizeBytes: {
          type: 'number',
        },
      },
    },
    totals: {
      type: 'object',
      additionalProperties: false,
      required: [
        'tables',
        'indexes',
        'invalidIndexes',
        'estimatedRows',
        'deadRows',
        'tableSizeBytes',
        'indexSizeBytes',
        'totalSizeBytes',
      ],
      properties: {
        tables: {
          type: 'number',
        },
        indexes: {
          type: 'number',
        },
        invalidIndexes: {
          type: 'number',
        },
        estimatedRows: {
          type: 'number',
        },
        deadRows: {
          type: 'number',
        },
        tableSizeBytes: {
          type: 'number',
        },
        indexSizeBytes: {
          type: 'number',
        },
        totalSizeBytes: {
          type: 'number',
        },
      },
    },
    tables: {
      type: 'array',
      items: adminDatabaseTableOverviewSchema,
    },
    relationships: {
      type: 'array',
      items: adminDatabaseRelationshipSchema,
    },
  },
} as const;
export const adminDatabaseColumnSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
    },
    ordinalPosition: {
      type: 'number',
    },
    dataType: {
      type: 'string',
    },
    nullable: {
      type: 'boolean',
    },
    defaultValue: {
      type: ['string', 'null'],
    },
  },
  required: ['name', 'ordinalPosition', 'dataType', 'nullable', 'defaultValue'],
} as const;

export const adminDatabaseConstraintSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
    },
    type: {
      type: 'string',
      enum: ['PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK'],
    },
    columns: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    definition: {
      type: 'string',
    },
  },
  required: ['name', 'type', 'columns', 'definition'],
} as const;

export const adminDatabaseIndexSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
    },
    columns: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    unique: {
      type: 'boolean',
    },
    primary: {
      type: 'boolean',
    },
    valid: {
      type: 'boolean',
    },
    ready: {
      type: 'boolean',
    },
    sizeBytes: {
      type: 'number',
    },
    definition: {
      type: 'string',
    },
  },
  required: ['name', 'columns', 'unique', 'primary', 'valid', 'ready', 'sizeBytes', 'definition'],
} as const;

export const adminDatabaseTableDetailsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    table: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
        },
        schema: {
          type: 'string',
        },
        label: {
          type: 'string',
        },
        group: {
          type: 'string',
          enum: ['core', 'events', 'matches', 'reconciliation', 'system'],
        },
        sensitive: {
          type: 'boolean',
        },
        maintenance: {
          type: 'boolean',
        },
      },
      required: ['name', 'schema', 'label', 'group', 'sensitive', 'maintenance'],
    },
    statistics: adminDatabaseTableOverviewSchema,
    columns: {
      type: 'array',
      items: adminDatabaseColumnSchema,
    },
    constraints: {
      type: 'array',
      items: adminDatabaseConstraintSchema,
    },
    indexes: {
      type: 'array',
      items: adminDatabaseIndexSchema,
    },
    relationships: {
      type: 'object',
      additionalProperties: false,
      properties: {
        outgoing: {
          type: 'array',
          items: adminDatabaseRelationshipSchema,
        },
        incoming: {
          type: 'array',
          items: adminDatabaseRelationshipSchema,
        },
      },
      required: ['outgoing', 'incoming'],
    },
  },
  required: ['table', 'statistics', 'columns', 'constraints', 'indexes', 'relationships'],
} as const;
export const adminDatabaseMaintenanceOperationSchema = {
  type: 'string',
  enum: ['analyze', 'vacuum_analyze', 'reindex_concurrently'],
} as const;
export const adminDatabaseMaintenanceRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    operation: adminDatabaseMaintenanceOperationSchema,
  },
  required: ['operation'],
} as const;
export const adminDatabaseMaintenanceResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tableName: {
      type: 'string',
    },
    operation: adminDatabaseMaintenanceOperationSchema,
    completedAt: {
      type: 'string',
    },
  },
  required: ['tableName', 'operation', 'completedAt'],
} as const;
export const adminDatabaseResetRequestSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    confirmation: {
      type: 'string',
      enum: ['RESET_APPLICATION'],
    },
    acknowledgement: {
      type: 'string',
      enum: ['I understand'],
    },
  },
  required: ['confirmation', 'acknowledgement'],
} as const;
export const adminDatabaseResetResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resetAt: {
      type: 'string',
    },
    restartRequired: {
      type: 'boolean',
      enum: [true],
    },
  },
  required: ['resetAt', 'restartRequired'],
} as const;
export const adminDatabaseMaintenanceAllResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tableName: {
      type: 'string',
    },
    completed: {
      type: 'boolean',
    },
    error: {
      type: ['string', 'null'],
    },
  },
  required: ['tableName', 'completed', 'error'],
} as const;
export const adminDatabaseMaintenanceAllResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    operation: adminDatabaseMaintenanceOperationSchema,
    completedAt: {
      type: 'string',
    },
    results: {
      type: 'array',
      items: adminDatabaseMaintenanceAllResultSchema,
    },
  },
  required: ['operation', 'completedAt', 'results'],
} as const;
