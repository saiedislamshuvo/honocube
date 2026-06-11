---
sidebar_position: 5
---

# AI & LLM Integration

HonoCube is designed to be highly compatible with AI development tools like Cursor, Windsurf, Claude, and ChatGPT. 

Because the backend API and frontend Admin panels are often separate codebases, it is crucial that the AI building your frontend understands exactly how the HonoCube API behaves (e.g., query parameters, responses, pagination).

To make this seamless, we provide a unified `llm.txt` file.

## Using `llm.txt`

The `llm.txt` file is a plain-text, markdown-formatted file containing the entire core knowledge base of HonoCube API. 

**How to use it:**
Simply copy the URL to the file and paste it into your AI prompt or AI IDE context window.

```text
https://honocube.sugarcanedev.com/llm.txt
```
*(Replace `honocube.sugarcanedev.com` with your actual docs domain if you are self-hosting these docs)*

---

## Admin Panel AI System Prompt

If you are using Cursor, Windsurf, or a custom GPT to generate a frontend Admin panel that consumes a HonoCube API, copy and paste the prompt below into your `.cursorrules` or `.windsurfrules` file.

```markdown
You are an expert Frontend Developer building an Admin Dashboard.
The backend you are communicating with is built using HonoCube API.

# HonoCube API Rules & Constraints
Read the full API spec here: https://honocube.sugarcanedev.com/llm.txt

When interacting with the API, you MUST follow these rules:

1. **Standard Responses:**
   All successful responses have the shape `{ "success": true, "data": ... }`.
   List responses include pagination meta: `{ "success": true, "data": [...], "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 } }`.

2. **Querying & Searching:**
   - Always use `?page=1&limit=20` for pagination. Do not use offset.
   - For global search, use the `q` parameter: `?q=searchterm`.
   - For exact matching, use direct parameters: `?status=active`.
   - For range queries, append suffixes: `?price__gte=100&price__lte=500`. Available suffixes: `__gte`, `__lte`, `__gt`, `__lt`, `__like`.

3. **Relationships:**
   - If relations are configured on the backend, the API will automatically sync nested objects on `POST` and `PATCH`. 
   - E.g., to create a post with comments, send `{ "title": "...", "comments": [{ "text": "..." }] }`.

4. **Batch Operations:**
   - To update multiple rows at once: `PATCH /resource/batch-update` with `{ "ids": [1,2], "data": { "status": "published" } }`.
   - To delete multiple rows: `POST /resource/batch-delete` with `{ "ids": [1,2] }`.
```
