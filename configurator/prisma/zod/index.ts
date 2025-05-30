import { z } from 'zod';
import type { Prisma } from '@prisma/client';

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////


/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const UserScalarFieldEnumSchema = z.enum(['id','email','hashedPassword','name']);

export const SessionScalarFieldEnumSchema = z.enum(['id','userId','expiresAt']);

export const GooseSettingScalarFieldEnumSchema = z.enum(['id','vlanPriority','vlanId','appId','dstAddress','ethernetInterface','useVlanTag','goId','goCb','timeAllowedToLive','dataSetRef','simulation','confRev','ndsCom','createdAt','updatedAt']);

export const SampledValuesSettingScalarFieldEnumSchema = z.enum(['id','appId','ethernetInterface','dstAddressCheck','threshold','createdAt','updatedAt']);

export const SampledValueScalarFieldEnumSchema = z.enum(['id','time','app_id','phase','rms_value']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const QueryModeSchema = z.enum(['default','insensitive']);

export const NullsOrderSchema = z.enum(['first','last']);
/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  hashedPassword: z.string(),
  name: z.string().nullable(),
})

export type User = z.infer<typeof UserSchema>

// USER RELATION SCHEMA
//------------------------------------------------------

export type UserRelations = {
  sessions: SessionWithRelations[];
};

export type UserWithRelations = z.infer<typeof UserSchema> & UserRelations

export const UserWithRelationsSchema: z.ZodType<UserWithRelations> = UserSchema.merge(z.object({
  sessions: z.lazy(() => SessionWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SESSION SCHEMA
/////////////////////////////////////////

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.coerce.date(),
})

export type Session = z.infer<typeof SessionSchema>

// SESSION RELATION SCHEMA
//------------------------------------------------------

export type SessionRelations = {
  user: UserWithRelations;
};

export type SessionWithRelations = z.infer<typeof SessionSchema> & SessionRelations

export const SessionWithRelationsSchema: z.ZodType<SessionWithRelations> = SessionSchema.merge(z.object({
  user: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// GOOSE SETTING SCHEMA
/////////////////////////////////////////

export const GooseSettingSchema = z.object({
  id: z.string().cuid(),
  vlanPriority: z.number().int(),
  vlanId: z.number().int(),
  appId: z.number().int(),
  dstAddress: z.string().nullable(),
  ethernetInterface: z.string(),
  useVlanTag: z.boolean().nullable(),
  goId: z.string(),
  goCb: z.string(),
  timeAllowedToLive: z.number().int(),
  dataSetRef: z.string(),
  simulation: z.boolean().nullable(),
  confRev: z.number().int(),
  ndsCom: z.boolean().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type GooseSetting = z.infer<typeof GooseSettingSchema>

/////////////////////////////////////////
// SAMPLED VALUES SETTING SCHEMA
/////////////////////////////////////////

export const SampledValuesSettingSchema = z.object({
  id: z.string().cuid(),
  appId: z.number().int(),
  ethernetInterface: z.string(),
  dstAddressCheck: z.boolean(),
  threshold: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type SampledValuesSetting = z.infer<typeof SampledValuesSettingSchema>

/////////////////////////////////////////
// SAMPLED VALUE SCHEMA
/////////////////////////////////////////

export const SampledValueSchema = z.object({
  id: z.number().int(),
  time: z.coerce.date(),
  app_id: z.string(),
  phase: z.number().int(),
  rms_value: z.number(),
})

export type SampledValue = z.infer<typeof SampledValueSchema>

/////////////////////////////////////////
// SELECT & INCLUDE
/////////////////////////////////////////

// USER
//------------------------------------------------------

export const UserIncludeSchema: z.ZodType<Prisma.UserInclude> = z.object({
  sessions: z.union([z.boolean(),z.lazy(() => SessionFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => UserCountOutputTypeArgsSchema)]).optional(),
}).strict()

export const UserArgsSchema: z.ZodType<Prisma.UserDefaultArgs> = z.object({
  select: z.lazy(() => UserSelectSchema).optional(),
  include: z.lazy(() => UserIncludeSchema).optional(),
}).strict();

export const UserCountOutputTypeArgsSchema: z.ZodType<Prisma.UserCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => UserCountOutputTypeSelectSchema).nullish(),
}).strict();

export const UserCountOutputTypeSelectSchema: z.ZodType<Prisma.UserCountOutputTypeSelect> = z.object({
  sessions: z.boolean().optional(),
}).strict();

export const UserSelectSchema: z.ZodType<Prisma.UserSelect> = z.object({
  id: z.boolean().optional(),
  email: z.boolean().optional(),
  hashedPassword: z.boolean().optional(),
  name: z.boolean().optional(),
  sessions: z.union([z.boolean(),z.lazy(() => SessionFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => UserCountOutputTypeArgsSchema)]).optional(),
}).strict()

// SESSION
//------------------------------------------------------

export const SessionIncludeSchema: z.ZodType<Prisma.SessionInclude> = z.object({
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

export const SessionArgsSchema: z.ZodType<Prisma.SessionDefaultArgs> = z.object({
  select: z.lazy(() => SessionSelectSchema).optional(),
  include: z.lazy(() => SessionIncludeSchema).optional(),
}).strict();

export const SessionSelectSchema: z.ZodType<Prisma.SessionSelect> = z.object({
  id: z.boolean().optional(),
  userId: z.boolean().optional(),
  expiresAt: z.boolean().optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

// GOOSE SETTING
//------------------------------------------------------

export const GooseSettingSelectSchema: z.ZodType<Prisma.GooseSettingSelect> = z.object({
  id: z.boolean().optional(),
  vlanPriority: z.boolean().optional(),
  vlanId: z.boolean().optional(),
  appId: z.boolean().optional(),
  dstAddress: z.boolean().optional(),
  ethernetInterface: z.boolean().optional(),
  useVlanTag: z.boolean().optional(),
  goId: z.boolean().optional(),
  goCb: z.boolean().optional(),
  timeAllowedToLive: z.boolean().optional(),
  dataSetRef: z.boolean().optional(),
  simulation: z.boolean().optional(),
  confRev: z.boolean().optional(),
  ndsCom: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
}).strict()

// SAMPLED VALUES SETTING
//------------------------------------------------------

export const SampledValuesSettingSelectSchema: z.ZodType<Prisma.SampledValuesSettingSelect> = z.object({
  id: z.boolean().optional(),
  appId: z.boolean().optional(),
  ethernetInterface: z.boolean().optional(),
  dstAddressCheck: z.boolean().optional(),
  threshold: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
}).strict()

// SAMPLED VALUE
//------------------------------------------------------

export const SampledValueSelectSchema: z.ZodType<Prisma.SampledValueSelect> = z.object({
  id: z.boolean().optional(),
  time: z.boolean().optional(),
  app_id: z.boolean().optional(),
  phase: z.boolean().optional(),
  rms_value: z.boolean().optional(),
}).strict()


/////////////////////////////////////////
// INPUT TYPES
/////////////////////////////////////////

export const UserWhereInputSchema: z.ZodType<Prisma.UserWhereInput> = z.object({
  AND: z.union([ z.lazy(() => UserWhereInputSchema),z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema),z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  email: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  hashedPassword: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  sessions: z.lazy(() => SessionListRelationFilterSchema).optional()
}).strict();

export const UserOrderByWithRelationInputSchema: z.ZodType<Prisma.UserOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  hashedPassword: z.lazy(() => SortOrderSchema).optional(),
  name: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  sessions: z.lazy(() => SessionOrderByRelationAggregateInputSchema).optional()
}).strict();

export const UserWhereUniqueInputSchema: z.ZodType<Prisma.UserWhereUniqueInput> = z.union([
  z.object({
    id: z.string(),
    email: z.string()
  }),
  z.object({
    id: z.string(),
  }),
  z.object({
    email: z.string(),
  }),
])
.and(z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  AND: z.union([ z.lazy(() => UserWhereInputSchema),z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema),z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  hashedPassword: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  sessions: z.lazy(() => SessionListRelationFilterSchema).optional()
}).strict());

export const UserOrderByWithAggregationInputSchema: z.ZodType<Prisma.UserOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  hashedPassword: z.lazy(() => SortOrderSchema).optional(),
  name: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  _count: z.lazy(() => UserCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => UserMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => UserMinOrderByAggregateInputSchema).optional()
}).strict();

export const UserScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.UserScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => UserScalarWhereWithAggregatesInputSchema),z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserScalarWhereWithAggregatesInputSchema),z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  email: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  hashedPassword: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
}).strict();

export const SessionWhereInputSchema: z.ZodType<Prisma.SessionWhereInput> = z.object({
  AND: z.union([ z.lazy(() => SessionWhereInputSchema),z.lazy(() => SessionWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SessionWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SessionWhereInputSchema),z.lazy(() => SessionWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  expiresAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
}).strict();

export const SessionOrderByWithRelationInputSchema: z.ZodType<Prisma.SessionOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  expiresAt: z.lazy(() => SortOrderSchema).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputSchema).optional()
}).strict();

export const SessionWhereUniqueInputSchema: z.ZodType<Prisma.SessionWhereUniqueInput> = z.object({
  id: z.string()
})
.and(z.object({
  id: z.string().optional(),
  AND: z.union([ z.lazy(() => SessionWhereInputSchema),z.lazy(() => SessionWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SessionWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SessionWhereInputSchema),z.lazy(() => SessionWhereInputSchema).array() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  expiresAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema),z.lazy(() => UserWhereInputSchema) ]).optional(),
}).strict());

export const SessionOrderByWithAggregationInputSchema: z.ZodType<Prisma.SessionOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  expiresAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => SessionCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => SessionMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => SessionMinOrderByAggregateInputSchema).optional()
}).strict();

export const SessionScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.SessionScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => SessionScalarWhereWithAggregatesInputSchema),z.lazy(() => SessionScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => SessionScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SessionScalarWhereWithAggregatesInputSchema),z.lazy(() => SessionScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  expiresAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
}).strict();

export const GooseSettingWhereInputSchema: z.ZodType<Prisma.GooseSettingWhereInput> = z.object({
  AND: z.union([ z.lazy(() => GooseSettingWhereInputSchema),z.lazy(() => GooseSettingWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => GooseSettingWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => GooseSettingWhereInputSchema),z.lazy(() => GooseSettingWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  vlanPriority: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  vlanId: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  appId: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  dstAddress: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  ethernetInterface: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  useVlanTag: z.union([ z.lazy(() => BoolNullableFilterSchema),z.boolean() ]).optional().nullable(),
  goId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  goCb: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  timeAllowedToLive: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  dataSetRef: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  simulation: z.union([ z.lazy(() => BoolNullableFilterSchema),z.boolean() ]).optional().nullable(),
  confRev: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  ndsCom: z.union([ z.lazy(() => BoolNullableFilterSchema),z.boolean() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
}).strict();

export const GooseSettingOrderByWithRelationInputSchema: z.ZodType<Prisma.GooseSettingOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  dstAddress: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  useVlanTag: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  goId: z.lazy(() => SortOrderSchema).optional(),
  goCb: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  dataSetRef: z.lazy(() => SortOrderSchema).optional(),
  simulation: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional(),
  ndsCom: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const GooseSettingWhereUniqueInputSchema: z.ZodType<Prisma.GooseSettingWhereUniqueInput> = z.object({
  id: z.string().cuid()
})
.and(z.object({
  id: z.string().cuid().optional(),
  AND: z.union([ z.lazy(() => GooseSettingWhereInputSchema),z.lazy(() => GooseSettingWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => GooseSettingWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => GooseSettingWhereInputSchema),z.lazy(() => GooseSettingWhereInputSchema).array() ]).optional(),
  vlanPriority: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  vlanId: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  appId: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  dstAddress: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  ethernetInterface: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  useVlanTag: z.union([ z.lazy(() => BoolNullableFilterSchema),z.boolean() ]).optional().nullable(),
  goId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  goCb: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  timeAllowedToLive: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  dataSetRef: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  simulation: z.union([ z.lazy(() => BoolNullableFilterSchema),z.boolean() ]).optional().nullable(),
  confRev: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  ndsCom: z.union([ z.lazy(() => BoolNullableFilterSchema),z.boolean() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
}).strict());

export const GooseSettingOrderByWithAggregationInputSchema: z.ZodType<Prisma.GooseSettingOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  dstAddress: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  useVlanTag: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  goId: z.lazy(() => SortOrderSchema).optional(),
  goCb: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  dataSetRef: z.lazy(() => SortOrderSchema).optional(),
  simulation: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional(),
  ndsCom: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => GooseSettingCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => GooseSettingAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => GooseSettingMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => GooseSettingMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => GooseSettingSumOrderByAggregateInputSchema).optional()
}).strict();

export const GooseSettingScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.GooseSettingScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => GooseSettingScalarWhereWithAggregatesInputSchema),z.lazy(() => GooseSettingScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => GooseSettingScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => GooseSettingScalarWhereWithAggregatesInputSchema),z.lazy(() => GooseSettingScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  vlanPriority: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  vlanId: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  appId: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  dstAddress: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema),z.string() ]).optional().nullable(),
  ethernetInterface: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  useVlanTag: z.union([ z.lazy(() => BoolNullableWithAggregatesFilterSchema),z.boolean() ]).optional().nullable(),
  goId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  goCb: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  timeAllowedToLive: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  dataSetRef: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  simulation: z.union([ z.lazy(() => BoolNullableWithAggregatesFilterSchema),z.boolean() ]).optional().nullable(),
  confRev: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  ndsCom: z.union([ z.lazy(() => BoolNullableWithAggregatesFilterSchema),z.boolean() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
}).strict();

export const SampledValuesSettingWhereInputSchema: z.ZodType<Prisma.SampledValuesSettingWhereInput> = z.object({
  AND: z.union([ z.lazy(() => SampledValuesSettingWhereInputSchema),z.lazy(() => SampledValuesSettingWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SampledValuesSettingWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SampledValuesSettingWhereInputSchema),z.lazy(() => SampledValuesSettingWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  appId: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  ethernetInterface: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  dstAddressCheck: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  threshold: z.union([ z.lazy(() => FloatFilterSchema),z.number() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
}).strict();

export const SampledValuesSettingOrderByWithRelationInputSchema: z.ZodType<Prisma.SampledValuesSettingOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  dstAddressCheck: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValuesSettingWhereUniqueInputSchema: z.ZodType<Prisma.SampledValuesSettingWhereUniqueInput> = z.object({
  id: z.string().cuid()
})
.and(z.object({
  id: z.string().cuid().optional(),
  AND: z.union([ z.lazy(() => SampledValuesSettingWhereInputSchema),z.lazy(() => SampledValuesSettingWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SampledValuesSettingWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SampledValuesSettingWhereInputSchema),z.lazy(() => SampledValuesSettingWhereInputSchema).array() ]).optional(),
  appId: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  ethernetInterface: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  dstAddressCheck: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  threshold: z.union([ z.lazy(() => FloatFilterSchema),z.number() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
}).strict());

export const SampledValuesSettingOrderByWithAggregationInputSchema: z.ZodType<Prisma.SampledValuesSettingOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  dstAddressCheck: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => SampledValuesSettingCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => SampledValuesSettingAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => SampledValuesSettingMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => SampledValuesSettingMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => SampledValuesSettingSumOrderByAggregateInputSchema).optional()
}).strict();

export const SampledValuesSettingScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.SampledValuesSettingScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => SampledValuesSettingScalarWhereWithAggregatesInputSchema),z.lazy(() => SampledValuesSettingScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => SampledValuesSettingScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SampledValuesSettingScalarWhereWithAggregatesInputSchema),z.lazy(() => SampledValuesSettingScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  appId: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  ethernetInterface: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  dstAddressCheck: z.union([ z.lazy(() => BoolWithAggregatesFilterSchema),z.boolean() ]).optional(),
  threshold: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema),z.number() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
}).strict();

export const SampledValueWhereInputSchema: z.ZodType<Prisma.SampledValueWhereInput> = z.object({
  AND: z.union([ z.lazy(() => SampledValueWhereInputSchema),z.lazy(() => SampledValueWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SampledValueWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SampledValueWhereInputSchema),z.lazy(() => SampledValueWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  time: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  app_id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  phase: z.union([ z.lazy(() => IntFilterSchema),z.number() ]).optional(),
  rms_value: z.union([ z.lazy(() => FloatFilterSchema),z.number() ]).optional(),
}).strict();

export const SampledValueOrderByWithRelationInputSchema: z.ZodType<Prisma.SampledValueOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  time: z.lazy(() => SortOrderSchema).optional(),
  app_id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValueWhereUniqueInputSchema: z.ZodType<Prisma.SampledValueWhereUniqueInput> = z.object({
  id_time: z.lazy(() => SampledValueIdTimeCompoundUniqueInputSchema)
})
.and(z.object({
  id_time: z.lazy(() => SampledValueIdTimeCompoundUniqueInputSchema).optional(),
  AND: z.union([ z.lazy(() => SampledValueWhereInputSchema),z.lazy(() => SampledValueWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SampledValueWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SampledValueWhereInputSchema),z.lazy(() => SampledValueWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  time: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  app_id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  phase: z.union([ z.lazy(() => IntFilterSchema),z.number().int() ]).optional(),
  rms_value: z.union([ z.lazy(() => FloatFilterSchema),z.number() ]).optional(),
}).strict());

export const SampledValueOrderByWithAggregationInputSchema: z.ZodType<Prisma.SampledValueOrderByWithAggregationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  time: z.lazy(() => SortOrderSchema).optional(),
  app_id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => SampledValueCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => SampledValueAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => SampledValueMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => SampledValueMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => SampledValueSumOrderByAggregateInputSchema).optional()
}).strict();

export const SampledValueScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.SampledValueScalarWhereWithAggregatesInput> = z.object({
  AND: z.union([ z.lazy(() => SampledValueScalarWhereWithAggregatesInputSchema),z.lazy(() => SampledValueScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => SampledValueScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SampledValueScalarWhereWithAggregatesInputSchema),z.lazy(() => SampledValueScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  time: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema),z.coerce.date() ]).optional(),
  app_id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema),z.string() ]).optional(),
  phase: z.union([ z.lazy(() => IntWithAggregatesFilterSchema),z.number() ]).optional(),
  rms_value: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema),z.number() ]).optional(),
}).strict();

export const UserCreateInputSchema: z.ZodType<Prisma.UserCreateInput> = z.object({
  id: z.string(),
  email: z.string(),
  hashedPassword: z.string(),
  name: z.string().optional().nullable(),
  sessions: z.lazy(() => SessionCreateNestedManyWithoutUserInputSchema).optional()
}).strict();

export const UserUncheckedCreateInputSchema: z.ZodType<Prisma.UserUncheckedCreateInput> = z.object({
  id: z.string(),
  email: z.string(),
  hashedPassword: z.string(),
  name: z.string().optional().nullable(),
  sessions: z.lazy(() => SessionUncheckedCreateNestedManyWithoutUserInputSchema).optional()
}).strict();

export const UserUpdateInputSchema: z.ZodType<Prisma.UserUpdateInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  hashedPassword: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  sessions: z.lazy(() => SessionUpdateManyWithoutUserNestedInputSchema).optional()
}).strict();

export const UserUncheckedUpdateInputSchema: z.ZodType<Prisma.UserUncheckedUpdateInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  hashedPassword: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  sessions: z.lazy(() => SessionUncheckedUpdateManyWithoutUserNestedInputSchema).optional()
}).strict();

export const UserCreateManyInputSchema: z.ZodType<Prisma.UserCreateManyInput> = z.object({
  id: z.string(),
  email: z.string(),
  hashedPassword: z.string(),
  name: z.string().optional().nullable()
}).strict();

export const UserUpdateManyMutationInputSchema: z.ZodType<Prisma.UserUpdateManyMutationInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  hashedPassword: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
}).strict();

export const UserUncheckedUpdateManyInputSchema: z.ZodType<Prisma.UserUncheckedUpdateManyInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  hashedPassword: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
}).strict();

export const SessionCreateInputSchema: z.ZodType<Prisma.SessionCreateInput> = z.object({
  id: z.string(),
  expiresAt: z.coerce.date(),
  user: z.lazy(() => UserCreateNestedOneWithoutSessionsInputSchema)
}).strict();

export const SessionUncheckedCreateInputSchema: z.ZodType<Prisma.SessionUncheckedCreateInput> = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.coerce.date()
}).strict();

export const SessionUpdateInputSchema: z.ZodType<Prisma.SessionUpdateInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutSessionsNestedInputSchema).optional()
}).strict();

export const SessionUncheckedUpdateInputSchema: z.ZodType<Prisma.SessionUncheckedUpdateInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SessionCreateManyInputSchema: z.ZodType<Prisma.SessionCreateManyInput> = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.coerce.date()
}).strict();

export const SessionUpdateManyMutationInputSchema: z.ZodType<Prisma.SessionUpdateManyMutationInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SessionUncheckedUpdateManyInputSchema: z.ZodType<Prisma.SessionUncheckedUpdateManyInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const GooseSettingCreateInputSchema: z.ZodType<Prisma.GooseSettingCreateInput> = z.object({
  id: z.string().cuid().optional(),
  vlanPriority: z.number().int(),
  vlanId: z.number().int(),
  appId: z.number().int(),
  dstAddress: z.string().optional().nullable(),
  ethernetInterface: z.string(),
  useVlanTag: z.boolean().optional().nullable(),
  goId: z.string(),
  goCb: z.string(),
  timeAllowedToLive: z.number().int(),
  dataSetRef: z.string(),
  simulation: z.boolean().optional().nullable(),
  confRev: z.number().int(),
  ndsCom: z.boolean().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();

export const GooseSettingUncheckedCreateInputSchema: z.ZodType<Prisma.GooseSettingUncheckedCreateInput> = z.object({
  id: z.string().cuid().optional(),
  vlanPriority: z.number().int(),
  vlanId: z.number().int(),
  appId: z.number().int(),
  dstAddress: z.string().optional().nullable(),
  ethernetInterface: z.string(),
  useVlanTag: z.boolean().optional().nullable(),
  goId: z.string(),
  goCb: z.string(),
  timeAllowedToLive: z.number().int(),
  dataSetRef: z.string(),
  simulation: z.boolean().optional().nullable(),
  confRev: z.number().int(),
  ndsCom: z.boolean().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();

export const GooseSettingUpdateInputSchema: z.ZodType<Prisma.GooseSettingUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  vlanPriority: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  vlanId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddress: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  useVlanTag: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  goId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  goCb: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  timeAllowedToLive: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dataSetRef: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  simulation: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  confRev: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ndsCom: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const GooseSettingUncheckedUpdateInputSchema: z.ZodType<Prisma.GooseSettingUncheckedUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  vlanPriority: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  vlanId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddress: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  useVlanTag: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  goId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  goCb: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  timeAllowedToLive: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dataSetRef: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  simulation: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  confRev: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ndsCom: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const GooseSettingCreateManyInputSchema: z.ZodType<Prisma.GooseSettingCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  vlanPriority: z.number().int(),
  vlanId: z.number().int(),
  appId: z.number().int(),
  dstAddress: z.string().optional().nullable(),
  ethernetInterface: z.string(),
  useVlanTag: z.boolean().optional().nullable(),
  goId: z.string(),
  goCb: z.string(),
  timeAllowedToLive: z.number().int(),
  dataSetRef: z.string(),
  simulation: z.boolean().optional().nullable(),
  confRev: z.number().int(),
  ndsCom: z.boolean().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();

export const GooseSettingUpdateManyMutationInputSchema: z.ZodType<Prisma.GooseSettingUpdateManyMutationInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  vlanPriority: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  vlanId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddress: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  useVlanTag: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  goId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  goCb: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  timeAllowedToLive: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dataSetRef: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  simulation: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  confRev: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ndsCom: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const GooseSettingUncheckedUpdateManyInputSchema: z.ZodType<Prisma.GooseSettingUncheckedUpdateManyInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  vlanPriority: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  vlanId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddress: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  useVlanTag: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  goId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  goCb: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  timeAllowedToLive: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  dataSetRef: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  simulation: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  confRev: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ndsCom: z.union([ z.boolean(),z.lazy(() => NullableBoolFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValuesSettingCreateInputSchema: z.ZodType<Prisma.SampledValuesSettingCreateInput> = z.object({
  id: z.string().cuid().optional(),
  appId: z.number().int(),
  ethernetInterface: z.string(),
  dstAddressCheck: z.boolean(),
  threshold: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();

export const SampledValuesSettingUncheckedCreateInputSchema: z.ZodType<Prisma.SampledValuesSettingUncheckedCreateInput> = z.object({
  id: z.string().cuid().optional(),
  appId: z.number().int(),
  ethernetInterface: z.string(),
  dstAddressCheck: z.boolean(),
  threshold: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();

export const SampledValuesSettingUpdateInputSchema: z.ZodType<Prisma.SampledValuesSettingUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddressCheck: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  threshold: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValuesSettingUncheckedUpdateInputSchema: z.ZodType<Prisma.SampledValuesSettingUncheckedUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddressCheck: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  threshold: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValuesSettingCreateManyInputSchema: z.ZodType<Prisma.SampledValuesSettingCreateManyInput> = z.object({
  id: z.string().cuid().optional(),
  appId: z.number().int(),
  ethernetInterface: z.string(),
  dstAddressCheck: z.boolean(),
  threshold: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();

export const SampledValuesSettingUpdateManyMutationInputSchema: z.ZodType<Prisma.SampledValuesSettingUpdateManyMutationInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddressCheck: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  threshold: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValuesSettingUncheckedUpdateManyInputSchema: z.ZodType<Prisma.SampledValuesSettingUncheckedUpdateManyInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  appId: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  ethernetInterface: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  dstAddressCheck: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  threshold: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValueCreateInputSchema: z.ZodType<Prisma.SampledValueCreateInput> = z.object({
  id: z.number().int().optional(),
  time: z.coerce.date(),
  app_id: z.string(),
  phase: z.number().int(),
  rms_value: z.number()
}).strict();

export const SampledValueUncheckedCreateInputSchema: z.ZodType<Prisma.SampledValueUncheckedCreateInput> = z.object({
  id: z.number().int().optional(),
  time: z.coerce.date(),
  app_id: z.string(),
  phase: z.number().int(),
  rms_value: z.number()
}).strict();

export const SampledValueUpdateInputSchema: z.ZodType<Prisma.SampledValueUpdateInput> = z.object({
  id: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  time: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  app_id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  phase: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  rms_value: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValueUncheckedUpdateInputSchema: z.ZodType<Prisma.SampledValueUncheckedUpdateInput> = z.object({
  id: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  time: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  app_id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  phase: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  rms_value: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValueCreateManyInputSchema: z.ZodType<Prisma.SampledValueCreateManyInput> = z.object({
  id: z.number().int().optional(),
  time: z.coerce.date(),
  app_id: z.string(),
  phase: z.number().int(),
  rms_value: z.number()
}).strict();

export const SampledValueUpdateManyMutationInputSchema: z.ZodType<Prisma.SampledValueUpdateManyMutationInput> = z.object({
  id: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  time: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  app_id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  phase: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  rms_value: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SampledValueUncheckedUpdateManyInputSchema: z.ZodType<Prisma.SampledValueUncheckedUpdateManyInput> = z.object({
  id: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  time: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  app_id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  phase: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  rms_value: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const StringFilterSchema: z.ZodType<Prisma.StringFilter> = z.object({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringFilterSchema) ]).optional(),
}).strict();

export const StringNullableFilterSchema: z.ZodType<Prisma.StringNullableFilter> = z.object({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableFilterSchema) ]).optional().nullable(),
}).strict();

export const SessionListRelationFilterSchema: z.ZodType<Prisma.SessionListRelationFilter> = z.object({
  every: z.lazy(() => SessionWhereInputSchema).optional(),
  some: z.lazy(() => SessionWhereInputSchema).optional(),
  none: z.lazy(() => SessionWhereInputSchema).optional()
}).strict();

export const SortOrderInputSchema: z.ZodType<Prisma.SortOrderInput> = z.object({
  sort: z.lazy(() => SortOrderSchema),
  nulls: z.lazy(() => NullsOrderSchema).optional()
}).strict();

export const SessionOrderByRelationAggregateInputSchema: z.ZodType<Prisma.SessionOrderByRelationAggregateInput> = z.object({
  _count: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const UserCountOrderByAggregateInputSchema: z.ZodType<Prisma.UserCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  hashedPassword: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const UserMaxOrderByAggregateInputSchema: z.ZodType<Prisma.UserMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  hashedPassword: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const UserMinOrderByAggregateInputSchema: z.ZodType<Prisma.UserMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  email: z.lazy(() => SortOrderSchema).optional(),
  hashedPassword: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const StringWithAggregatesFilterSchema: z.ZodType<Prisma.StringWithAggregatesFilter> = z.object({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional()
}).strict();

export const StringNullableWithAggregatesFilterSchema: z.ZodType<Prisma.StringNullableWithAggregatesFilter> = z.object({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedStringNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedStringNullableFilterSchema).optional()
}).strict();

export const DateTimeFilterSchema: z.ZodType<Prisma.DateTimeFilter> = z.object({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeFilterSchema) ]).optional(),
}).strict();

export const UserScalarRelationFilterSchema: z.ZodType<Prisma.UserScalarRelationFilter> = z.object({
  is: z.lazy(() => UserWhereInputSchema).optional(),
  isNot: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export const SessionCountOrderByAggregateInputSchema: z.ZodType<Prisma.SessionCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  expiresAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SessionMaxOrderByAggregateInputSchema: z.ZodType<Prisma.SessionMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  expiresAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SessionMinOrderByAggregateInputSchema: z.ZodType<Prisma.SessionMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  expiresAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const DateTimeWithAggregatesFilterSchema: z.ZodType<Prisma.DateTimeWithAggregatesFilter> = z.object({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeFilterSchema).optional()
}).strict();

export const IntFilterSchema: z.ZodType<Prisma.IntFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntFilterSchema) ]).optional(),
}).strict();

export const BoolNullableFilterSchema: z.ZodType<Prisma.BoolNullableFilter> = z.object({
  equals: z.boolean().optional().nullable(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolNullableFilterSchema) ]).optional().nullable(),
}).strict();

export const GooseSettingCountOrderByAggregateInputSchema: z.ZodType<Prisma.GooseSettingCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  dstAddress: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  useVlanTag: z.lazy(() => SortOrderSchema).optional(),
  goId: z.lazy(() => SortOrderSchema).optional(),
  goCb: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  dataSetRef: z.lazy(() => SortOrderSchema).optional(),
  simulation: z.lazy(() => SortOrderSchema).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional(),
  ndsCom: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const GooseSettingAvgOrderByAggregateInputSchema: z.ZodType<Prisma.GooseSettingAvgOrderByAggregateInput> = z.object({
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const GooseSettingMaxOrderByAggregateInputSchema: z.ZodType<Prisma.GooseSettingMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  dstAddress: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  useVlanTag: z.lazy(() => SortOrderSchema).optional(),
  goId: z.lazy(() => SortOrderSchema).optional(),
  goCb: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  dataSetRef: z.lazy(() => SortOrderSchema).optional(),
  simulation: z.lazy(() => SortOrderSchema).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional(),
  ndsCom: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const GooseSettingMinOrderByAggregateInputSchema: z.ZodType<Prisma.GooseSettingMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  dstAddress: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  useVlanTag: z.lazy(() => SortOrderSchema).optional(),
  goId: z.lazy(() => SortOrderSchema).optional(),
  goCb: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  dataSetRef: z.lazy(() => SortOrderSchema).optional(),
  simulation: z.lazy(() => SortOrderSchema).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional(),
  ndsCom: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const GooseSettingSumOrderByAggregateInputSchema: z.ZodType<Prisma.GooseSettingSumOrderByAggregateInput> = z.object({
  vlanPriority: z.lazy(() => SortOrderSchema).optional(),
  vlanId: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  timeAllowedToLive: z.lazy(() => SortOrderSchema).optional(),
  confRev: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const IntWithAggregatesFilterSchema: z.ZodType<Prisma.IntWithAggregatesFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedIntFilterSchema).optional(),
  _max: z.lazy(() => NestedIntFilterSchema).optional()
}).strict();

export const BoolNullableWithAggregatesFilterSchema: z.ZodType<Prisma.BoolNullableWithAggregatesFilter> = z.object({
  equals: z.boolean().optional().nullable(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedBoolNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedBoolNullableFilterSchema).optional()
}).strict();

export const BoolFilterSchema: z.ZodType<Prisma.BoolFilter> = z.object({
  equals: z.boolean().optional(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolFilterSchema) ]).optional(),
}).strict();

export const FloatFilterSchema: z.ZodType<Prisma.FloatFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatFilterSchema) ]).optional(),
}).strict();

export const SampledValuesSettingCountOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValuesSettingCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  dstAddressCheck: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValuesSettingAvgOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValuesSettingAvgOrderByAggregateInput> = z.object({
  appId: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValuesSettingMaxOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValuesSettingMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  dstAddressCheck: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValuesSettingMinOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValuesSettingMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  appId: z.lazy(() => SortOrderSchema).optional(),
  ethernetInterface: z.lazy(() => SortOrderSchema).optional(),
  dstAddressCheck: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValuesSettingSumOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValuesSettingSumOrderByAggregateInput> = z.object({
  appId: z.lazy(() => SortOrderSchema).optional(),
  threshold: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const BoolWithAggregatesFilterSchema: z.ZodType<Prisma.BoolWithAggregatesFilter> = z.object({
  equals: z.boolean().optional(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedBoolFilterSchema).optional(),
  _max: z.lazy(() => NestedBoolFilterSchema).optional()
}).strict();

export const FloatWithAggregatesFilterSchema: z.ZodType<Prisma.FloatWithAggregatesFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedFloatFilterSchema).optional(),
  _min: z.lazy(() => NestedFloatFilterSchema).optional(),
  _max: z.lazy(() => NestedFloatFilterSchema).optional()
}).strict();

export const SampledValueIdTimeCompoundUniqueInputSchema: z.ZodType<Prisma.SampledValueIdTimeCompoundUniqueInput> = z.object({
  id: z.number(),
  time: z.coerce.date()
}).strict();

export const SampledValueCountOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValueCountOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  time: z.lazy(() => SortOrderSchema).optional(),
  app_id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValueAvgOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValueAvgOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValueMaxOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValueMaxOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  time: z.lazy(() => SortOrderSchema).optional(),
  app_id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValueMinOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValueMinOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  time: z.lazy(() => SortOrderSchema).optional(),
  app_id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SampledValueSumOrderByAggregateInputSchema: z.ZodType<Prisma.SampledValueSumOrderByAggregateInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  phase: z.lazy(() => SortOrderSchema).optional(),
  rms_value: z.lazy(() => SortOrderSchema).optional()
}).strict();

export const SessionCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.SessionCreateNestedManyWithoutUserInput> = z.object({
  create: z.union([ z.lazy(() => SessionCreateWithoutUserInputSchema),z.lazy(() => SessionCreateWithoutUserInputSchema).array(),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema),z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => SessionCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export const SessionUncheckedCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.SessionUncheckedCreateNestedManyWithoutUserInput> = z.object({
  create: z.union([ z.lazy(() => SessionCreateWithoutUserInputSchema),z.lazy(() => SessionCreateWithoutUserInputSchema).array(),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema),z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => SessionCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
}).strict();

export const StringFieldUpdateOperationsInputSchema: z.ZodType<Prisma.StringFieldUpdateOperationsInput> = z.object({
  set: z.string().optional()
}).strict();

export const NullableStringFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableStringFieldUpdateOperationsInput> = z.object({
  set: z.string().optional().nullable()
}).strict();

export const SessionUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.SessionUpdateManyWithoutUserNestedInput> = z.object({
  create: z.union([ z.lazy(() => SessionCreateWithoutUserInputSchema),z.lazy(() => SessionCreateWithoutUserInputSchema).array(),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema),z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => SessionUpsertWithWhereUniqueWithoutUserInputSchema),z.lazy(() => SessionUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => SessionCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => SessionUpdateWithWhereUniqueWithoutUserInputSchema),z.lazy(() => SessionUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => SessionUpdateManyWithWhereWithoutUserInputSchema),z.lazy(() => SessionUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => SessionScalarWhereInputSchema),z.lazy(() => SessionScalarWhereInputSchema).array() ]).optional(),
}).strict();

export const SessionUncheckedUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.SessionUncheckedUpdateManyWithoutUserNestedInput> = z.object({
  create: z.union([ z.lazy(() => SessionCreateWithoutUserInputSchema),z.lazy(() => SessionCreateWithoutUserInputSchema).array(),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema),z.lazy(() => SessionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => SessionUpsertWithWhereUniqueWithoutUserInputSchema),z.lazy(() => SessionUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => SessionCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => SessionWhereUniqueInputSchema),z.lazy(() => SessionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => SessionUpdateWithWhereUniqueWithoutUserInputSchema),z.lazy(() => SessionUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => SessionUpdateManyWithWhereWithoutUserInputSchema),z.lazy(() => SessionUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => SessionScalarWhereInputSchema),z.lazy(() => SessionScalarWhereInputSchema).array() ]).optional(),
}).strict();

export const UserCreateNestedOneWithoutSessionsInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutSessionsInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedCreateWithoutSessionsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutSessionsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional()
}).strict();

export const DateTimeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.DateTimeFieldUpdateOperationsInput> = z.object({
  set: z.coerce.date().optional()
}).strict();

export const UserUpdateOneRequiredWithoutSessionsNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutSessionsNestedInput> = z.object({
  create: z.union([ z.lazy(() => UserCreateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedCreateWithoutSessionsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutSessionsInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutSessionsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutSessionsInputSchema),z.lazy(() => UserUpdateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutSessionsInputSchema) ]).optional(),
}).strict();

export const IntFieldUpdateOperationsInputSchema: z.ZodType<Prisma.IntFieldUpdateOperationsInput> = z.object({
  set: z.number().optional(),
  increment: z.number().optional(),
  decrement: z.number().optional(),
  multiply: z.number().optional(),
  divide: z.number().optional()
}).strict();

export const NullableBoolFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableBoolFieldUpdateOperationsInput> = z.object({
  set: z.boolean().optional().nullable()
}).strict();

export const BoolFieldUpdateOperationsInputSchema: z.ZodType<Prisma.BoolFieldUpdateOperationsInput> = z.object({
  set: z.boolean().optional()
}).strict();

export const FloatFieldUpdateOperationsInputSchema: z.ZodType<Prisma.FloatFieldUpdateOperationsInput> = z.object({
  set: z.number().optional(),
  increment: z.number().optional(),
  decrement: z.number().optional(),
  multiply: z.number().optional(),
  divide: z.number().optional()
}).strict();

export const NestedStringFilterSchema: z.ZodType<Prisma.NestedStringFilter> = z.object({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringFilterSchema) ]).optional(),
}).strict();

export const NestedStringNullableFilterSchema: z.ZodType<Prisma.NestedStringNullableFilter> = z.object({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableFilterSchema) ]).optional().nullable(),
}).strict();

export const NestedStringWithAggregatesFilterSchema: z.ZodType<Prisma.NestedStringWithAggregatesFilter> = z.object({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional()
}).strict();

export const NestedIntFilterSchema: z.ZodType<Prisma.NestedIntFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntFilterSchema) ]).optional(),
}).strict();

export const NestedStringNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedStringNullableWithAggregatesFilter> = z.object({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedStringNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedStringNullableFilterSchema).optional()
}).strict();

export const NestedIntNullableFilterSchema: z.ZodType<Prisma.NestedIntNullableFilter> = z.object({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntNullableFilterSchema) ]).optional().nullable(),
}).strict();

export const NestedDateTimeFilterSchema: z.ZodType<Prisma.NestedDateTimeFilter> = z.object({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeFilterSchema) ]).optional(),
}).strict();

export const NestedDateTimeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedDateTimeWithAggregatesFilter> = z.object({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeFilterSchema).optional()
}).strict();

export const NestedBoolNullableFilterSchema: z.ZodType<Prisma.NestedBoolNullableFilter> = z.object({
  equals: z.boolean().optional().nullable(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolNullableFilterSchema) ]).optional().nullable(),
}).strict();

export const NestedIntWithAggregatesFilterSchema: z.ZodType<Prisma.NestedIntWithAggregatesFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedIntFilterSchema).optional(),
  _max: z.lazy(() => NestedIntFilterSchema).optional()
}).strict();

export const NestedFloatFilterSchema: z.ZodType<Prisma.NestedFloatFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatFilterSchema) ]).optional(),
}).strict();

export const NestedBoolNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedBoolNullableWithAggregatesFilter> = z.object({
  equals: z.boolean().optional().nullable(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedBoolNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedBoolNullableFilterSchema).optional()
}).strict();

export const NestedBoolFilterSchema: z.ZodType<Prisma.NestedBoolFilter> = z.object({
  equals: z.boolean().optional(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolFilterSchema) ]).optional(),
}).strict();

export const NestedBoolWithAggregatesFilterSchema: z.ZodType<Prisma.NestedBoolWithAggregatesFilter> = z.object({
  equals: z.boolean().optional(),
  not: z.union([ z.boolean(),z.lazy(() => NestedBoolWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedBoolFilterSchema).optional(),
  _max: z.lazy(() => NestedBoolFilterSchema).optional()
}).strict();

export const NestedFloatWithAggregatesFilterSchema: z.ZodType<Prisma.NestedFloatWithAggregatesFilter> = z.object({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedFloatFilterSchema).optional(),
  _min: z.lazy(() => NestedFloatFilterSchema).optional(),
  _max: z.lazy(() => NestedFloatFilterSchema).optional()
}).strict();

export const SessionCreateWithoutUserInputSchema: z.ZodType<Prisma.SessionCreateWithoutUserInput> = z.object({
  id: z.string(),
  expiresAt: z.coerce.date()
}).strict();

export const SessionUncheckedCreateWithoutUserInputSchema: z.ZodType<Prisma.SessionUncheckedCreateWithoutUserInput> = z.object({
  id: z.string(),
  expiresAt: z.coerce.date()
}).strict();

export const SessionCreateOrConnectWithoutUserInputSchema: z.ZodType<Prisma.SessionCreateOrConnectWithoutUserInput> = z.object({
  where: z.lazy(() => SessionWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => SessionCreateWithoutUserInputSchema),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema) ]),
}).strict();

export const SessionCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.SessionCreateManyUserInputEnvelope> = z.object({
  data: z.union([ z.lazy(() => SessionCreateManyUserInputSchema),z.lazy(() => SessionCreateManyUserInputSchema).array() ]),
  skipDuplicates: z.boolean().optional()
}).strict();

export const SessionUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.SessionUpsertWithWhereUniqueWithoutUserInput> = z.object({
  where: z.lazy(() => SessionWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => SessionUpdateWithoutUserInputSchema),z.lazy(() => SessionUncheckedUpdateWithoutUserInputSchema) ]),
  create: z.union([ z.lazy(() => SessionCreateWithoutUserInputSchema),z.lazy(() => SessionUncheckedCreateWithoutUserInputSchema) ]),
}).strict();

export const SessionUpdateWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.SessionUpdateWithWhereUniqueWithoutUserInput> = z.object({
  where: z.lazy(() => SessionWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => SessionUpdateWithoutUserInputSchema),z.lazy(() => SessionUncheckedUpdateWithoutUserInputSchema) ]),
}).strict();

export const SessionUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.SessionUpdateManyWithWhereWithoutUserInput> = z.object({
  where: z.lazy(() => SessionScalarWhereInputSchema),
  data: z.union([ z.lazy(() => SessionUpdateManyMutationInputSchema),z.lazy(() => SessionUncheckedUpdateManyWithoutUserInputSchema) ]),
}).strict();

export const SessionScalarWhereInputSchema: z.ZodType<Prisma.SessionScalarWhereInput> = z.object({
  AND: z.union([ z.lazy(() => SessionScalarWhereInputSchema),z.lazy(() => SessionScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => SessionScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => SessionScalarWhereInputSchema),z.lazy(() => SessionScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema),z.string() ]).optional(),
  expiresAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
}).strict();

export const UserCreateWithoutSessionsInputSchema: z.ZodType<Prisma.UserCreateWithoutSessionsInput> = z.object({
  id: z.string(),
  email: z.string(),
  hashedPassword: z.string(),
  name: z.string().optional().nullable()
}).strict();

export const UserUncheckedCreateWithoutSessionsInputSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutSessionsInput> = z.object({
  id: z.string(),
  email: z.string(),
  hashedPassword: z.string(),
  name: z.string().optional().nullable()
}).strict();

export const UserCreateOrConnectWithoutSessionsInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutSessionsInput> = z.object({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedCreateWithoutSessionsInputSchema) ]),
}).strict();

export const UserUpsertWithoutSessionsInputSchema: z.ZodType<Prisma.UserUpsertWithoutSessionsInput> = z.object({
  update: z.union([ z.lazy(() => UserUpdateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutSessionsInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedCreateWithoutSessionsInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional()
}).strict();

export const UserUpdateToOneWithWhereWithoutSessionsInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutSessionsInput> = z.object({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutSessionsInputSchema),z.lazy(() => UserUncheckedUpdateWithoutSessionsInputSchema) ]),
}).strict();

export const UserUpdateWithoutSessionsInputSchema: z.ZodType<Prisma.UserUpdateWithoutSessionsInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  hashedPassword: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
}).strict();

export const UserUncheckedUpdateWithoutSessionsInputSchema: z.ZodType<Prisma.UserUncheckedUpdateWithoutSessionsInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  email: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  hashedPassword: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
}).strict();

export const SessionCreateManyUserInputSchema: z.ZodType<Prisma.SessionCreateManyUserInput> = z.object({
  id: z.string(),
  expiresAt: z.coerce.date()
}).strict();

export const SessionUpdateWithoutUserInputSchema: z.ZodType<Prisma.SessionUpdateWithoutUserInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SessionUncheckedUpdateWithoutUserInputSchema: z.ZodType<Prisma.SessionUncheckedUpdateWithoutUserInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

export const SessionUncheckedUpdateManyWithoutUserInputSchema: z.ZodType<Prisma.SessionUncheckedUpdateManyWithoutUserInput> = z.object({
  id: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  expiresAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
}).strict();

/////////////////////////////////////////
// ARGS
/////////////////////////////////////////

export const UserFindFirstArgsSchema: z.ZodType<Prisma.UserFindFirstArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(),
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(),UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema,UserScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const UserFindFirstOrThrowArgsSchema: z.ZodType<Prisma.UserFindFirstOrThrowArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(),
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(),UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema,UserScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const UserFindManyArgsSchema: z.ZodType<Prisma.UserFindManyArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(),
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(),UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema,UserScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const UserAggregateArgsSchema: z.ZodType<Prisma.UserAggregateArgs> = z.object({
  where: UserWhereInputSchema.optional(),
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(),UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const UserGroupByArgsSchema: z.ZodType<Prisma.UserGroupByArgs> = z.object({
  where: UserWhereInputSchema.optional(),
  orderBy: z.union([ UserOrderByWithAggregationInputSchema.array(),UserOrderByWithAggregationInputSchema ]).optional(),
  by: UserScalarFieldEnumSchema.array(),
  having: UserScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const UserFindUniqueArgsSchema: z.ZodType<Prisma.UserFindUniqueArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema,
}).strict() ;

export const UserFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.UserFindUniqueOrThrowArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema,
}).strict() ;

export const SessionFindFirstArgsSchema: z.ZodType<Prisma.SessionFindFirstArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereInputSchema.optional(),
  orderBy: z.union([ SessionOrderByWithRelationInputSchema.array(),SessionOrderByWithRelationInputSchema ]).optional(),
  cursor: SessionWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SessionScalarFieldEnumSchema,SessionScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SessionFindFirstOrThrowArgsSchema: z.ZodType<Prisma.SessionFindFirstOrThrowArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereInputSchema.optional(),
  orderBy: z.union([ SessionOrderByWithRelationInputSchema.array(),SessionOrderByWithRelationInputSchema ]).optional(),
  cursor: SessionWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SessionScalarFieldEnumSchema,SessionScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SessionFindManyArgsSchema: z.ZodType<Prisma.SessionFindManyArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereInputSchema.optional(),
  orderBy: z.union([ SessionOrderByWithRelationInputSchema.array(),SessionOrderByWithRelationInputSchema ]).optional(),
  cursor: SessionWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SessionScalarFieldEnumSchema,SessionScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SessionAggregateArgsSchema: z.ZodType<Prisma.SessionAggregateArgs> = z.object({
  where: SessionWhereInputSchema.optional(),
  orderBy: z.union([ SessionOrderByWithRelationInputSchema.array(),SessionOrderByWithRelationInputSchema ]).optional(),
  cursor: SessionWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const SessionGroupByArgsSchema: z.ZodType<Prisma.SessionGroupByArgs> = z.object({
  where: SessionWhereInputSchema.optional(),
  orderBy: z.union([ SessionOrderByWithAggregationInputSchema.array(),SessionOrderByWithAggregationInputSchema ]).optional(),
  by: SessionScalarFieldEnumSchema.array(),
  having: SessionScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const SessionFindUniqueArgsSchema: z.ZodType<Prisma.SessionFindUniqueArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereUniqueInputSchema,
}).strict() ;

export const SessionFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.SessionFindUniqueOrThrowArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereUniqueInputSchema,
}).strict() ;

export const GooseSettingFindFirstArgsSchema: z.ZodType<Prisma.GooseSettingFindFirstArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereInputSchema.optional(),
  orderBy: z.union([ GooseSettingOrderByWithRelationInputSchema.array(),GooseSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: GooseSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ GooseSettingScalarFieldEnumSchema,GooseSettingScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const GooseSettingFindFirstOrThrowArgsSchema: z.ZodType<Prisma.GooseSettingFindFirstOrThrowArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereInputSchema.optional(),
  orderBy: z.union([ GooseSettingOrderByWithRelationInputSchema.array(),GooseSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: GooseSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ GooseSettingScalarFieldEnumSchema,GooseSettingScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const GooseSettingFindManyArgsSchema: z.ZodType<Prisma.GooseSettingFindManyArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereInputSchema.optional(),
  orderBy: z.union([ GooseSettingOrderByWithRelationInputSchema.array(),GooseSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: GooseSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ GooseSettingScalarFieldEnumSchema,GooseSettingScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const GooseSettingAggregateArgsSchema: z.ZodType<Prisma.GooseSettingAggregateArgs> = z.object({
  where: GooseSettingWhereInputSchema.optional(),
  orderBy: z.union([ GooseSettingOrderByWithRelationInputSchema.array(),GooseSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: GooseSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const GooseSettingGroupByArgsSchema: z.ZodType<Prisma.GooseSettingGroupByArgs> = z.object({
  where: GooseSettingWhereInputSchema.optional(),
  orderBy: z.union([ GooseSettingOrderByWithAggregationInputSchema.array(),GooseSettingOrderByWithAggregationInputSchema ]).optional(),
  by: GooseSettingScalarFieldEnumSchema.array(),
  having: GooseSettingScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const GooseSettingFindUniqueArgsSchema: z.ZodType<Prisma.GooseSettingFindUniqueArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereUniqueInputSchema,
}).strict() ;

export const GooseSettingFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.GooseSettingFindUniqueOrThrowArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereUniqueInputSchema,
}).strict() ;

export const SampledValuesSettingFindFirstArgsSchema: z.ZodType<Prisma.SampledValuesSettingFindFirstArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereInputSchema.optional(),
  orderBy: z.union([ SampledValuesSettingOrderByWithRelationInputSchema.array(),SampledValuesSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValuesSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SampledValuesSettingScalarFieldEnumSchema,SampledValuesSettingScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SampledValuesSettingFindFirstOrThrowArgsSchema: z.ZodType<Prisma.SampledValuesSettingFindFirstOrThrowArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereInputSchema.optional(),
  orderBy: z.union([ SampledValuesSettingOrderByWithRelationInputSchema.array(),SampledValuesSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValuesSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SampledValuesSettingScalarFieldEnumSchema,SampledValuesSettingScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SampledValuesSettingFindManyArgsSchema: z.ZodType<Prisma.SampledValuesSettingFindManyArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereInputSchema.optional(),
  orderBy: z.union([ SampledValuesSettingOrderByWithRelationInputSchema.array(),SampledValuesSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValuesSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SampledValuesSettingScalarFieldEnumSchema,SampledValuesSettingScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SampledValuesSettingAggregateArgsSchema: z.ZodType<Prisma.SampledValuesSettingAggregateArgs> = z.object({
  where: SampledValuesSettingWhereInputSchema.optional(),
  orderBy: z.union([ SampledValuesSettingOrderByWithRelationInputSchema.array(),SampledValuesSettingOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValuesSettingWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const SampledValuesSettingGroupByArgsSchema: z.ZodType<Prisma.SampledValuesSettingGroupByArgs> = z.object({
  where: SampledValuesSettingWhereInputSchema.optional(),
  orderBy: z.union([ SampledValuesSettingOrderByWithAggregationInputSchema.array(),SampledValuesSettingOrderByWithAggregationInputSchema ]).optional(),
  by: SampledValuesSettingScalarFieldEnumSchema.array(),
  having: SampledValuesSettingScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const SampledValuesSettingFindUniqueArgsSchema: z.ZodType<Prisma.SampledValuesSettingFindUniqueArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereUniqueInputSchema,
}).strict() ;

export const SampledValuesSettingFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.SampledValuesSettingFindUniqueOrThrowArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereUniqueInputSchema,
}).strict() ;

export const SampledValueFindFirstArgsSchema: z.ZodType<Prisma.SampledValueFindFirstArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereInputSchema.optional(),
  orderBy: z.union([ SampledValueOrderByWithRelationInputSchema.array(),SampledValueOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValueWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SampledValueScalarFieldEnumSchema,SampledValueScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SampledValueFindFirstOrThrowArgsSchema: z.ZodType<Prisma.SampledValueFindFirstOrThrowArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereInputSchema.optional(),
  orderBy: z.union([ SampledValueOrderByWithRelationInputSchema.array(),SampledValueOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValueWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SampledValueScalarFieldEnumSchema,SampledValueScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SampledValueFindManyArgsSchema: z.ZodType<Prisma.SampledValueFindManyArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereInputSchema.optional(),
  orderBy: z.union([ SampledValueOrderByWithRelationInputSchema.array(),SampledValueOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValueWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ SampledValueScalarFieldEnumSchema,SampledValueScalarFieldEnumSchema.array() ]).optional(),
}).strict() ;

export const SampledValueAggregateArgsSchema: z.ZodType<Prisma.SampledValueAggregateArgs> = z.object({
  where: SampledValueWhereInputSchema.optional(),
  orderBy: z.union([ SampledValueOrderByWithRelationInputSchema.array(),SampledValueOrderByWithRelationInputSchema ]).optional(),
  cursor: SampledValueWhereUniqueInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const SampledValueGroupByArgsSchema: z.ZodType<Prisma.SampledValueGroupByArgs> = z.object({
  where: SampledValueWhereInputSchema.optional(),
  orderBy: z.union([ SampledValueOrderByWithAggregationInputSchema.array(),SampledValueOrderByWithAggregationInputSchema ]).optional(),
  by: SampledValueScalarFieldEnumSchema.array(),
  having: SampledValueScalarWhereWithAggregatesInputSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict() ;

export const SampledValueFindUniqueArgsSchema: z.ZodType<Prisma.SampledValueFindUniqueArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereUniqueInputSchema,
}).strict() ;

export const SampledValueFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.SampledValueFindUniqueOrThrowArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereUniqueInputSchema,
}).strict() ;

export const UserCreateArgsSchema: z.ZodType<Prisma.UserCreateArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  data: z.union([ UserCreateInputSchema,UserUncheckedCreateInputSchema ]),
}).strict() ;

export const UserUpsertArgsSchema: z.ZodType<Prisma.UserUpsertArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema,
  create: z.union([ UserCreateInputSchema,UserUncheckedCreateInputSchema ]),
  update: z.union([ UserUpdateInputSchema,UserUncheckedUpdateInputSchema ]),
}).strict() ;

export const UserCreateManyArgsSchema: z.ZodType<Prisma.UserCreateManyArgs> = z.object({
  data: z.union([ UserCreateManyInputSchema,UserCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const UserCreateManyAndReturnArgsSchema: z.ZodType<Prisma.UserCreateManyAndReturnArgs> = z.object({
  data: z.union([ UserCreateManyInputSchema,UserCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const UserDeleteArgsSchema: z.ZodType<Prisma.UserDeleteArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema,
}).strict() ;

export const UserUpdateArgsSchema: z.ZodType<Prisma.UserUpdateArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  data: z.union([ UserUpdateInputSchema,UserUncheckedUpdateInputSchema ]),
  where: UserWhereUniqueInputSchema,
}).strict() ;

export const UserUpdateManyArgsSchema: z.ZodType<Prisma.UserUpdateManyArgs> = z.object({
  data: z.union([ UserUpdateManyMutationInputSchema,UserUncheckedUpdateManyInputSchema ]),
  where: UserWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const UserUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.UserUpdateManyAndReturnArgs> = z.object({
  data: z.union([ UserUpdateManyMutationInputSchema,UserUncheckedUpdateManyInputSchema ]),
  where: UserWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const UserDeleteManyArgsSchema: z.ZodType<Prisma.UserDeleteManyArgs> = z.object({
  where: UserWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SessionCreateArgsSchema: z.ZodType<Prisma.SessionCreateArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  data: z.union([ SessionCreateInputSchema,SessionUncheckedCreateInputSchema ]),
}).strict() ;

export const SessionUpsertArgsSchema: z.ZodType<Prisma.SessionUpsertArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereUniqueInputSchema,
  create: z.union([ SessionCreateInputSchema,SessionUncheckedCreateInputSchema ]),
  update: z.union([ SessionUpdateInputSchema,SessionUncheckedUpdateInputSchema ]),
}).strict() ;

export const SessionCreateManyArgsSchema: z.ZodType<Prisma.SessionCreateManyArgs> = z.object({
  data: z.union([ SessionCreateManyInputSchema,SessionCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const SessionCreateManyAndReturnArgsSchema: z.ZodType<Prisma.SessionCreateManyAndReturnArgs> = z.object({
  data: z.union([ SessionCreateManyInputSchema,SessionCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const SessionDeleteArgsSchema: z.ZodType<Prisma.SessionDeleteArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  where: SessionWhereUniqueInputSchema,
}).strict() ;

export const SessionUpdateArgsSchema: z.ZodType<Prisma.SessionUpdateArgs> = z.object({
  select: SessionSelectSchema.optional(),
  include: SessionIncludeSchema.optional(),
  data: z.union([ SessionUpdateInputSchema,SessionUncheckedUpdateInputSchema ]),
  where: SessionWhereUniqueInputSchema,
}).strict() ;

export const SessionUpdateManyArgsSchema: z.ZodType<Prisma.SessionUpdateManyArgs> = z.object({
  data: z.union([ SessionUpdateManyMutationInputSchema,SessionUncheckedUpdateManyInputSchema ]),
  where: SessionWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SessionUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.SessionUpdateManyAndReturnArgs> = z.object({
  data: z.union([ SessionUpdateManyMutationInputSchema,SessionUncheckedUpdateManyInputSchema ]),
  where: SessionWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SessionDeleteManyArgsSchema: z.ZodType<Prisma.SessionDeleteManyArgs> = z.object({
  where: SessionWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const GooseSettingCreateArgsSchema: z.ZodType<Prisma.GooseSettingCreateArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  data: z.union([ GooseSettingCreateInputSchema,GooseSettingUncheckedCreateInputSchema ]),
}).strict() ;

export const GooseSettingUpsertArgsSchema: z.ZodType<Prisma.GooseSettingUpsertArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereUniqueInputSchema,
  create: z.union([ GooseSettingCreateInputSchema,GooseSettingUncheckedCreateInputSchema ]),
  update: z.union([ GooseSettingUpdateInputSchema,GooseSettingUncheckedUpdateInputSchema ]),
}).strict() ;

export const GooseSettingCreateManyArgsSchema: z.ZodType<Prisma.GooseSettingCreateManyArgs> = z.object({
  data: z.union([ GooseSettingCreateManyInputSchema,GooseSettingCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const GooseSettingCreateManyAndReturnArgsSchema: z.ZodType<Prisma.GooseSettingCreateManyAndReturnArgs> = z.object({
  data: z.union([ GooseSettingCreateManyInputSchema,GooseSettingCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const GooseSettingDeleteArgsSchema: z.ZodType<Prisma.GooseSettingDeleteArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  where: GooseSettingWhereUniqueInputSchema,
}).strict() ;

export const GooseSettingUpdateArgsSchema: z.ZodType<Prisma.GooseSettingUpdateArgs> = z.object({
  select: GooseSettingSelectSchema.optional(),
  data: z.union([ GooseSettingUpdateInputSchema,GooseSettingUncheckedUpdateInputSchema ]),
  where: GooseSettingWhereUniqueInputSchema,
}).strict() ;

export const GooseSettingUpdateManyArgsSchema: z.ZodType<Prisma.GooseSettingUpdateManyArgs> = z.object({
  data: z.union([ GooseSettingUpdateManyMutationInputSchema,GooseSettingUncheckedUpdateManyInputSchema ]),
  where: GooseSettingWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const GooseSettingUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.GooseSettingUpdateManyAndReturnArgs> = z.object({
  data: z.union([ GooseSettingUpdateManyMutationInputSchema,GooseSettingUncheckedUpdateManyInputSchema ]),
  where: GooseSettingWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const GooseSettingDeleteManyArgsSchema: z.ZodType<Prisma.GooseSettingDeleteManyArgs> = z.object({
  where: GooseSettingWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SampledValuesSettingCreateArgsSchema: z.ZodType<Prisma.SampledValuesSettingCreateArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  data: z.union([ SampledValuesSettingCreateInputSchema,SampledValuesSettingUncheckedCreateInputSchema ]),
}).strict() ;

export const SampledValuesSettingUpsertArgsSchema: z.ZodType<Prisma.SampledValuesSettingUpsertArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereUniqueInputSchema,
  create: z.union([ SampledValuesSettingCreateInputSchema,SampledValuesSettingUncheckedCreateInputSchema ]),
  update: z.union([ SampledValuesSettingUpdateInputSchema,SampledValuesSettingUncheckedUpdateInputSchema ]),
}).strict() ;

export const SampledValuesSettingCreateManyArgsSchema: z.ZodType<Prisma.SampledValuesSettingCreateManyArgs> = z.object({
  data: z.union([ SampledValuesSettingCreateManyInputSchema,SampledValuesSettingCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const SampledValuesSettingCreateManyAndReturnArgsSchema: z.ZodType<Prisma.SampledValuesSettingCreateManyAndReturnArgs> = z.object({
  data: z.union([ SampledValuesSettingCreateManyInputSchema,SampledValuesSettingCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const SampledValuesSettingDeleteArgsSchema: z.ZodType<Prisma.SampledValuesSettingDeleteArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  where: SampledValuesSettingWhereUniqueInputSchema,
}).strict() ;

export const SampledValuesSettingUpdateArgsSchema: z.ZodType<Prisma.SampledValuesSettingUpdateArgs> = z.object({
  select: SampledValuesSettingSelectSchema.optional(),
  data: z.union([ SampledValuesSettingUpdateInputSchema,SampledValuesSettingUncheckedUpdateInputSchema ]),
  where: SampledValuesSettingWhereUniqueInputSchema,
}).strict() ;

export const SampledValuesSettingUpdateManyArgsSchema: z.ZodType<Prisma.SampledValuesSettingUpdateManyArgs> = z.object({
  data: z.union([ SampledValuesSettingUpdateManyMutationInputSchema,SampledValuesSettingUncheckedUpdateManyInputSchema ]),
  where: SampledValuesSettingWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SampledValuesSettingUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.SampledValuesSettingUpdateManyAndReturnArgs> = z.object({
  data: z.union([ SampledValuesSettingUpdateManyMutationInputSchema,SampledValuesSettingUncheckedUpdateManyInputSchema ]),
  where: SampledValuesSettingWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SampledValuesSettingDeleteManyArgsSchema: z.ZodType<Prisma.SampledValuesSettingDeleteManyArgs> = z.object({
  where: SampledValuesSettingWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SampledValueCreateArgsSchema: z.ZodType<Prisma.SampledValueCreateArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  data: z.union([ SampledValueCreateInputSchema,SampledValueUncheckedCreateInputSchema ]),
}).strict() ;

export const SampledValueUpsertArgsSchema: z.ZodType<Prisma.SampledValueUpsertArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereUniqueInputSchema,
  create: z.union([ SampledValueCreateInputSchema,SampledValueUncheckedCreateInputSchema ]),
  update: z.union([ SampledValueUpdateInputSchema,SampledValueUncheckedUpdateInputSchema ]),
}).strict() ;

export const SampledValueCreateManyArgsSchema: z.ZodType<Prisma.SampledValueCreateManyArgs> = z.object({
  data: z.union([ SampledValueCreateManyInputSchema,SampledValueCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const SampledValueCreateManyAndReturnArgsSchema: z.ZodType<Prisma.SampledValueCreateManyAndReturnArgs> = z.object({
  data: z.union([ SampledValueCreateManyInputSchema,SampledValueCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict() ;

export const SampledValueDeleteArgsSchema: z.ZodType<Prisma.SampledValueDeleteArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  where: SampledValueWhereUniqueInputSchema,
}).strict() ;

export const SampledValueUpdateArgsSchema: z.ZodType<Prisma.SampledValueUpdateArgs> = z.object({
  select: SampledValueSelectSchema.optional(),
  data: z.union([ SampledValueUpdateInputSchema,SampledValueUncheckedUpdateInputSchema ]),
  where: SampledValueWhereUniqueInputSchema,
}).strict() ;

export const SampledValueUpdateManyArgsSchema: z.ZodType<Prisma.SampledValueUpdateManyArgs> = z.object({
  data: z.union([ SampledValueUpdateManyMutationInputSchema,SampledValueUncheckedUpdateManyInputSchema ]),
  where: SampledValueWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SampledValueUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.SampledValueUpdateManyAndReturnArgs> = z.object({
  data: z.union([ SampledValueUpdateManyMutationInputSchema,SampledValueUncheckedUpdateManyInputSchema ]),
  where: SampledValueWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;

export const SampledValueDeleteManyArgsSchema: z.ZodType<Prisma.SampledValueDeleteManyArgs> = z.object({
  where: SampledValueWhereInputSchema.optional(),
  limit: z.number().optional(),
}).strict() ;