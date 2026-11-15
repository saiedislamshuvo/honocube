# @honocube/core

Pure headless data layer, state machines, and theme contracts for HonoCube.
Contains **ZERO** UI rendering components, styling tokens, or Tailwind/Radix dependencies.

## Overview

`@honocube/core` provides the foundational headless primitives for building enterprise web applications, CRMs, and ERPs with HonoCube:

- **Collection & App Definitions**: `defineCollection`, `defineApp`
- **API Client & Networking**: `createApiClient`, `ApiClientError`
- **React Query Hooks**: `AppProvider`, `useApp`, `useCollectionQuery`, `useCollectionMutation`, `useApiClient`
- **Headless Table Engine**: `useCollectionList`, `generateColumnsFromCollection`, `url-sync`
- **Headless Form Engine**: `useCollectionForm`, `useChildCollection`, `createChildCollectionHelper`, `evaluateComputedFields`, `evaluateFieldCapability`, `validateRecord`, `validateField`, `getDefaultFormValues`
- **Workflow State Machine Engine**: `useCollectionWorkflow`, `getCurrentWorkflowState`, `getStateMetadata`, `isRecordLocked`, `getAvailableTransitions`
- **Routing Resolution**: `resolveWorkspaceRoute`
- **Theme Contracts**: `createTheme`, `isHonoCubeTheme`, `resolveTheme`, `HonoCubeTheme`, `ThemeComponents`
- **Type Definitions**: Comprehensive TypeScript models for fields, collections, views, workflows, and workspace applications

## Installation

```bash
yarn add @honocube/core
# or
npm install @honocube/core
```

## Peer Dependencies

Ensure your project installs the compatible peer dependencies:
- `react` (`^18.0.0 || ^19.0.0`)
- `react-dom` (`^18.0.0 || ^19.0.0`)
- `@tanstack/react-query` (`^5.0.0`)
- `@tanstack/react-table` (`^8.0.0 || ^9.0.0`)
- `@tanstack/react-form` (`^0.40.0 || ^1.0.0`)
