# AI_RULES

This file is the source of truth for how this app is built. Follow it in every change.

## Tech Stack
- **React** — the app is a React single-page application.
- **TypeScript** — all source files use TypeScript (`.ts` / `.tsx`); no plain JavaScript.
- **Vite** — the build tooling and dev server.
- **React Router** — client-side routing; keep all routes defined in `src/App.tsx`.
- **Tailwind CSS** — style everything with Tailwind utility classes (no separate CSS-in-JS or component CSS files).
- **shadcn/ui** — the primary component library, built on Radix UI primitives.
- **Radix UI** — headless primitives that back shadcn/ui components.
- **lucide-react** — the standard icon set.
- **React Hooks + Context** — default state management; avoid global stores (e.g. Redux) unless explicitly requested.

## Project Structure
- Put all source code in `src/`.
- Pages go in `src/pages/`; the default page is `src/pages/Index.tsx`.
- Reusable components go in `src/components/`.
- Always wire new components into the page that renders them (usually `src/pages/Index.tsx`) so they are visible.

## Library Usage Rules
- **Styling:** Use **Tailwind CSS** utility classes for all layout, spacing, color, and typography. Do not hand-write CSS unless absolutely necessary.
- **UI components:** Use **shadcn/ui** components first. They are already installed — do not reinstall them. Import from `src/components/ui/*`.
- **Editing components:** Do **not** edit files in `src/components/ui/` directly. Create a new component in `src/components/` if you need different behavior.
- **Headless/unstyled primitives:** Use **Radix UI** directly only when no shadcn/ui component exists for the need.
- **Icons:** Use **lucide-react** for all icons. Do not add other icon packs.
- **Routing:** Use **React Router** (`react-router-dom`) for navigation. Define routes only in `src/App.tsx`.
- **Forms & validation:** Use shadcn/ui form components with **react-hook-form** and **zod** for validation.
- **Dates:** Use **date-fns** for date utilities.
- **Class names:** Use the `cn()` helper (clsx + tailwind-merge) from `src/lib/utils` to merge Tailwind classes conditionally.
- **Notifications/toasts:** Use the shadcn/ui **sonner** (or `use-toast`) component; do not add separate toast libraries.
- **Adding dependencies:** Before installing a new package, check whether the need is already covered by shadcn/ui, Radix UI, lucide-react, or the libraries above. Prefer existing tools over new dependencies.

## General Conventions
- Keep components small, focused, and readable.
- Do not introduce security vulnerabilities (XSS, injection, etc.).
- Do not make partial/placeholder implementations — every change must be complete and functional.
- Only edit files related to the current request; leave unrelated files untouched.
