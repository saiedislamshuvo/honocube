# Relationships

Honocube provides powerful abstractions for handling database relationships, allowing you to fetch related data automatically and maintain integrity during updates.

## Supported Relation Types

- **One-to-One / One-to-Many (`one`):** Direct foreign key relationships.
- **Many-to-Many (`many`):** Direct associations where the child table contains the foreign key.
- **Pivots (`pivots`):** Many-to-many relationships through a join table.

## Defining Relations

Relations are defined within the `relations` property of a resource config.

```typescript
export const postsResource = defineResource({
  name: "posts",
  table: postsTable,
  // ...
  relations: {
    one: [
      {
        name: "author",
        table: usersTable,
        referenceKey: "id",
        foreignKey: "authorId",
      },
    ],
    many: [
      {
        name: "comments",
        table: commentsTable,
        foreignKey: "postId",
      },
    ],
  },
});
```

## Eager Loading with `with`

To include related data in your API responses, use the `with` property. Honocube uses Drizzle's relational query API to fetch this data efficiently.

```typescript
export const postsResource = defineResource({
  // ...
  with: {
    author: true,
    comments: {
      with: {
        user: true,
      },
    },
  },
});
```

## Pivots (Many-to-Many)

For join tables, use the `pivots` array.

```typescript
relations: {
  pivots: [
    {
      name: "tags",
      table: postTagsTable,         // The join table
      foreignKey: "postId",        // Key on join table pointing to Post
      referenceKey: "tagId",       // Key on join table pointing to Tag
      targetTable: tagsTable,      // The table being joined
      targetReferenceKey: "id",    // Key on Tag table
    },
  ],
}
```

## Recursive Finalization

Honocube automatically handles:
1.  **Hiding Fields:** Recursive removal of `hidden` fields in related records.
2.  **Upload URLs:** Resolving media URLs for file fields in related records.
3.  **Transforms:** Applying custom transformation functions to related objects.

## Updating Relations

When creating or updating a parent record, you can send relation data in the payload. Honocube supports several strategies (defaulting to `replace`) to synchronize these collections during `PATCH` requests.

```typescript
// Example Payload
{
  "title": "My New Post",
  "comments": [
    { "content": "Great post!" },
    { "content": "Thanks for sharing." }
  ]
}
```

In the next section, we'll cover [Authentication & Permissions](./auth.md).
