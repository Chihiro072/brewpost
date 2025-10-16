/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createNode = /* GraphQL */ `mutation CreateNode($input: CreateNodeInput!, $condition: ModelNodeConditionInput) {
  createNode(input: $input, condition: $condition) {
    id
    projectId
    nodeId
    title
    description
    x
    y
    status
    contentId
    type
    day
    imageUrl
    imageUrls
    imagePrompt
    scheduledDate
    createdAt
    updatedAt
    __typename
  }
}` as GeneratedMutation<
  APITypes.CreateNodeMutationVariables,
  APITypes.CreateNodeMutation
>;
export const updateNode = /* GraphQL */ `mutation UpdateNode($input: UpdateNodeInput!, $condition: ModelNodeConditionInput) {
  updateNode(input: $input, condition: $condition) {
    id
    projectId
    nodeId
    title
    description
    x
    y
    status
    contentId
    type
    day
    imageUrl
    imageUrls
    imagePrompt
    scheduledDate
    createdAt
    updatedAt
    __typename
  }
}` as GeneratedMutation<
  APITypes.UpdateNodeMutationVariables,
  APITypes.UpdateNodeMutation
>;
export const deleteNode = /* GraphQL */ `mutation DeleteNode($input: DeleteNodeInput!, $condition: ModelNodeConditionInput) {
  deleteNode(input: $input, condition: $condition) {
    id
    projectId
    nodeId
    title
    description
    x
    y
    status
    contentId
    type
    day
    imageUrl
    imageUrls
    imagePrompt
    scheduledDate
    createdAt
    updatedAt
    __typename
  }
}` as GeneratedMutation<
  APITypes.DeleteNodeMutationVariables,
  APITypes.DeleteNodeMutation
>;
export const createEdge = /* GraphQL */ `mutation CreateEdge($input: CreateEdgeInput!, $condition: ModelEdgeConditionInput) {
  createEdge(input: $input, condition: $condition) {
    id
    projectId
    edgeId
    from
    to
    createdAt
    updatedAt
    __typename
  }
}` as GeneratedMutation<
  APITypes.CreateEdgeMutationVariables,
  APITypes.CreateEdgeMutation
>;
export const deleteEdge = /* GraphQL */ `mutation DeleteEdge($input: DeleteEdgeInput!, $condition: ModelEdgeConditionInput) {
  deleteEdge(input: $input, condition: $condition) {
    id
    projectId
    edgeId
    from
    to
    createdAt
    updatedAt
    __typename
  }
}` as GeneratedMutation<
  APITypes.DeleteEdgeMutationVariables,
  APITypes.DeleteEdgeMutation
>;
export const generateContent = /* GraphQL */ `mutation GenerateContent(
  $projectId: ID!
  $kind: String!
  $prompt: String!
  $model: String!
) {
  generateContent(
    projectId: $projectId
    kind: $kind
    prompt: $prompt
    model: $model
  ) {
    contentId
    projectId
    kind
    prompt
    text
    imageKey
    model
    createdAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.GenerateContentMutationVariables,
  APITypes.GenerateContentMutation
>;
export const createSchedule = /* GraphQL */ `mutation CreateSchedule($input: CreateScheduleInput!) {
  createSchedule(input: $input) {
    id
    scheduleId
    title
    content
    imageUrl
    imageUrls
    scheduledDate
    status
    userId
    createdAt
    updatedAt
    __typename
  }
}` as GeneratedMutation<
  APITypes.CreateScheduleMutationVariables,
  APITypes.CreateScheduleMutation
>;
