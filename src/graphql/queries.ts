/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const listNodes = /* GraphQL */ `query ListNodes($filter: ModelNodeFilterInput, $limit: Int, $nextToken: String) {
  listNodes(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}` as GeneratedQuery<APITypes.ListNodesQueryVariables, APITypes.ListNodesQuery>;
export const listEdges = /* GraphQL */ `query ListEdges($filter: ModelEdgeFilterInput, $limit: Int, $nextToken: String) {
  listEdges(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      projectId
      edgeId
      from
      to
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}` as GeneratedQuery<APITypes.ListEdgesQueryVariables, APITypes.ListEdgesQuery>;
export const getContent = /* GraphQL */ `query GetContent($contentId: ID!) {
  getContent(contentId: $contentId) {
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
` as GeneratedQuery<
  APITypes.GetContentQueryVariables,
  APITypes.GetContentQuery
>;
export const listSchedules = /* GraphQL */ `query ListSchedules($filter: ModelScheduleFilterInput, $limit: Int, $nextToken: String) {
  listSchedules(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}` as GeneratedQuery<
  APITypes.ListSchedulesQueryVariables,
  APITypes.ListSchedulesQuery
>;
