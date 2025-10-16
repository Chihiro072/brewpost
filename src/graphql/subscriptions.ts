/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onNodeCreated = /* GraphQL */ `subscription OnNodeCreated($projectId: ID!) {
  onNodeCreated(projectId: $projectId) {
    projectId
    nodeId
    title
    description
    x
    y
    status
    contentId
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnNodeCreatedSubscriptionVariables,
  APITypes.OnNodeCreatedSubscription
>;
export const onNodeUpdated = /* GraphQL */ `subscription OnNodeUpdated($projectId: ID!) {
  onNodeUpdated(projectId: $projectId) {
    projectId
    nodeId
    title
    description
    x
    y
    status
    contentId
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnNodeUpdatedSubscriptionVariables,
  APITypes.OnNodeUpdatedSubscription
>;
export const onNodeDeleted = /* GraphQL */ `subscription OnNodeDeleted($projectId: ID!) {
  onNodeDeleted(projectId: $projectId) {
    projectId
    nodeId
    title
    description
    x
    y
    status
    contentId
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnNodeDeletedSubscriptionVariables,
  APITypes.OnNodeDeletedSubscription
>;
export const onEdgeChanged = /* GraphQL */ `subscription OnEdgeChanged($projectId: ID!) {
  onEdgeChanged(projectId: $projectId) {
    projectId
    edgeId
    from
    to
    label
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnEdgeChangedSubscriptionVariables,
  APITypes.OnEdgeChangedSubscription
>;
export const onContentReady = /* GraphQL */ `subscription OnContentReady($projectId: ID!) {
  onContentReady(projectId: $projectId) {
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
` as GeneratedSubscription<
  APITypes.OnContentReadySubscriptionVariables,
  APITypes.OnContentReadySubscription
>;
