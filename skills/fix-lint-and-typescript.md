# Skill: Fix Lint and TypeScript Errors

This skill provides step-by-step instructions for identifying, auto-fixing, and manually resolving all ESLint rules and TypeScript compilation errors in the codebase.

## Objective
Ensure the project is 100% clean of all lint errors/warnings and TypeScript issues before concluding any development task.

## Step 1: Run Auto-Fixers
Automated tools can resolve many basic styling and structure issues.

1. Run the eslint auto-fix command:
   ```bash
   npm run lint:fix
   ```
2. If `lint:fix` is not defined in `package.json`, run:
   ```bash
   npx eslint . --fix
   ```

## Step 2: Run Type-Checking
TypeScript verification ensures static analysis correctness.

1. Run the type-checker command:
   ```bash
   npm run typecheck
   ```
2. If `typecheck` is not defined in `package.json`, run:
   ```bash
   npx tsc --noEmit
   ```

## Step 3: Resolve Common Errors

### 1. Unexpected `any` (`@typescript-eslint/no-explicit-any`)
- **Fix**: Replace `any` with the correct type. If the type is dynamic, use `unknown`. If it's a JSON object, define an interface or use `Record<string, unknown>`.
- **Avoid**: Do not just use `// eslint-disable-next-line` unless absolutely necessary (e.g., library mismatch).

### 2. Unused Variables (`@typescript-eslint/no-unused-vars`)
- **Fix**: Remove the unused variable or parameter. If it's required for signature matching, prefix it with an underscore (e.g., `_err` or `_event`).

### 3. Direct State Updates in useEffect (`react-hooks/set-state-in-effect`)
- **Error**: "Calling setState synchronously within an effect can trigger cascading renders"
- **Fix**:
  - Avoid calling state updates unconditionally directly inside a `useEffect` body.
  - If fetching data, wrap the state update inside the promise/async handler resolution.
  - Ensure the effect has a dependency array or conditional checks to prevent infinite/cascading loops.

### 4. Unescaped Entities (`react/no-unescaped-entities`)
- **Error**: "`'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`"
- **Fix**: Replace `'` with `&apos;` or `{"'"}` in JSX/TSX content.

### 5. Standard `<img>` Tags (`@next/next/no-img-element`)
- **Fix**: Use Next.js `<Image />` component from `next/image` with proper width/height or layout properties, or configure a custom image loader if dynamic styling is required.

## Step 4: Verification
Confirm that all checks pass:
1. `npm run lint` outputs `0 problems` (or only warnings if they are ignored/expected).
2. `npm run typecheck` exits with code `0`.
