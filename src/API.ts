/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateNodeInput = {
  projectId: string,
  title: string,
  description?: string | null,
  x?: number | null,
  y?: number | null,
  status?: string | null,
  contentId?: string | null,
};

export type Node = {
  __typename: "Node",
  projectId: string,
  nodeId: string,
  title: string,
  description?: string | null,
  x?: number | null,
  y?: number | null,
  status?: string | null,
  contentId?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateNodeInput = {
  projectId: string,
  nodeId: string,
  title?: string | null,
  description?: string | null,
  x?: number | null,
  y?: number | null,
  status?: string | null,
  contentId?: string | null,
};

export type Edge = {
  __typename: "Edge",
  projectId: string,
  edgeId: string,
  from: string,
  to: string,
  label?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type Content = {
  __typename: "Content",
  contentId: string,
  projectId: string,
  kind: string,
  // "image" | "text"
  prompt: string,
  text?: string | null,
  imageKey?: string | null,
  model?: string | null,
  createdAt: string,
};

export type Schedule = {
  __typename: "Schedule",
  id: string,
  scheduleId: string,
  title: string,
  content?: string | null,
  imageUrl?: string | null,
  imageUrls?: string[] | null,
  scheduledDate: string,
  status: string,
  userId?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type CreateNodeMutationVariables = {
  input: CreateNodeInput,
};

export type CreateNodeMutation = {
  createNode:  {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type UpdateNodeMutationVariables = {
  input: UpdateNodeInput,
};

export type UpdateNodeMutation = {
  updateNode:  {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type DeleteNodeMutationVariables = {
  projectId: string,
  nodeId: string,
};

export type DeleteNodeMutation = {
  deleteNode:  {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type CreateEdgeMutationVariables = {
  projectId: string,
  from: string,
  to: string,
  label?: string | null,
};

export type CreateEdgeMutation = {
  createEdge:  {
    __typename: "Edge",
    projectId: string,
    edgeId: string,
    from: string,
    to: string,
    label?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type DeleteEdgeMutationVariables = {
  projectId: string,
  edgeId: string,
};

export type DeleteEdgeMutation = {
  deleteEdge:  {
    __typename: "Edge",
    projectId: string,
    edgeId: string,
    from: string,
    to: string,
    label?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type GenerateContentMutationVariables = {
  projectId: string,
  kind: string,
  prompt: string,
  model: string,
};

export type GenerateContentMutation = {
  generateContent:  {
    __typename: "Content",
    contentId: string,
    projectId: string,
    kind: string,
    // "image" | "text"
    prompt: string,
    text?: string | null,
    imageKey?: string | null,
    model?: string | null,
    createdAt: string,
  },
};

export type CreateScheduleInput = {
  scheduleId: string,
  title: string,
  content?: string | null,
  imageUrl?: string | null,
  imageUrls?: string[] | null,
  scheduledDate: string,
  status: string,
  userId?: string | null,
};

export type CreateScheduleMutationVariables = {
  input: CreateScheduleInput,
};

export type CreateScheduleMutation = {
  createSchedule: {
    __typename: "Schedule",
    id: string,
    scheduleId: string,
    title: string,
    content?: string | null,
    imageUrl?: string | null,
    imageUrls?: string[] | null,
    scheduledDate: string,
    status: string,
    userId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type ListNodesQueryVariables = {
  projectId: string,
};

export type ListNodesQuery = {
  listNodes:  Array< {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  } >,
};

export type ListEdgesQueryVariables = {
  projectId: string,
};

export type ListEdgesQuery = {
  listEdges:  Array< {
    __typename: "Edge",
    projectId: string,
    edgeId: string,
    from: string,
    to: string,
    label?: string | null,
    createdAt: string,
    updatedAt: string,
  } >,
};

export type GetContentQueryVariables = {
  contentId: string,
};

export type GetContentQuery = {
  getContent?:  {
    __typename: "Content",
    contentId: string,
    projectId: string,
    kind: string,
    // "image" | "text"
    prompt: string,
    text?: string | null,
    imageKey?: string | null,
    model?: string | null,
    createdAt: string,
  } | null,
};

export type ListSchedulesQueryVariables = {
  projectId: string,
};

export type ListSchedulesQuery = {
  listSchedules:  Array< {
    __typename: "Schedule",
    scheduleId: string,
    userId: string,
    projectId: string,
    nodeId: string,
    whenISO: string,
    channel: string,
    status?: string | null,
  } >,
};

export type OnNodeCreatedSubscriptionVariables = {
  projectId: string,
};

export type OnNodeCreatedSubscription = {
  onNodeCreated:  {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type OnNodeUpdatedSubscriptionVariables = {
  projectId: string,
};

export type OnNodeUpdatedSubscription = {
  onNodeUpdated:  {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type OnNodeDeletedSubscriptionVariables = {
  projectId: string,
};

export type OnNodeDeletedSubscription = {
  onNodeDeleted:  {
    __typename: "Node",
    projectId: string,
    nodeId: string,
    title: string,
    description?: string | null,
    x?: number | null,
    y?: number | null,
    status?: string | null,
    contentId?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type OnEdgeChangedSubscriptionVariables = {
  projectId: string,
};

export type OnEdgeChangedSubscription = {
  onEdgeChanged:  {
    __typename: "Edge",
    projectId: string,
    edgeId: string,
    from: string,
    to: string,
    label?: string | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type OnContentReadySubscriptionVariables = {
  projectId: string,
};

export type OnContentReadySubscription = {
  onContentReady:  {
    __typename: "Content",
    contentId: string,
    projectId: string,
    kind: string,
    // "image" | "text"
    prompt: string,
    text?: string | null,
    imageKey?: string | null,
    model?: string | null,
    createdAt: string,
  },
};
