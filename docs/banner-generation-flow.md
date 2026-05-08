# Banner Generation Flow

## 1. Entry Point
- The user submits `/dashboard/create`, which calls `POST /api/banners`.
- The API validates the request, creates a generation job, and returns a `jobId` immediately.
- The UI polls `GET /api/generation-status/[jobId]` until the job completes or fails.
- The same status endpoint is also used by `/dashboard/banners` to show live generation cards.

## 2. Step-by-Step Generation Pipeline

### Step 1: Validate uploaded images
- Reference and subject image URLs are checked for accessibility before generation starts.
- The job enters the `UPLOAD_IMAGES` step so the UI can show the first progress state.

### Step 2: Analyze reference and subject images
- Reference and subject analysis run in parallel.
- Both analyses use the admin-configured model access path and return structured context:
  - palette and mood
  - layout guidance
  - subject placement
  - design suggestions

### Step 3: Find a background image
- The server queries the configured background image providers.
- The background search category is derived from the prompt and the image analysis output.
- If a provider returns an image, it is attached to the generation context.
- If no provider returns a valid result, the flow continues without a background image.

### Step 4: Generate variants with all enabled text models
- The server fans out to every enabled text model in parallel.
- Each model receives the prompt, extracted image context, and any background image that was found.
- This stage is parallel, but the overall workflow stays sequential.

### Step 5: Score all variants
- Every model result is scored for quality and readiness.
- The highest-scoring variant wins, even if no result clears the threshold.

### Step 6: Persist the result
- The winning banner, run record, and all scored variants are stored in the database.
- The job is marked complete and the final banner payload is returned by the status endpoint.

## 3. Job Status Payload
- Each job exposes:
  - `status`
  - `currentStep`
  - `progress`
  - `stepsCompleted`
  - `results`
  - `banner`
  - `banners`
  - `variants`
- The polling UI uses this payload to show progress on both the create page and the banners dashboard.

## 4. Admin Diagnostics
- The admin dashboard includes a `Connections` page at `/admin/connections`.
- It can test:
  - database connectivity
  - a specific enabled model
  - a specific background image provider
  - the full model + provider flow
- The diagnostics page calls `POST /api/admin/connections` and shows the raw test result so admins can fix the exact failing integration.

## 5. Image Rendering in the Editor and Builder
- `subject_image_url` is preserved separately from the AI-generated template.
- Render helpers normalize that image back into the `bg_image` field at view time.
- The builder and editor both use the same render path, so the subject image appears consistently in:
  - dashboard thumbnails
  - detail previews
  - editor previews
  - builder overlays
  - exports

## 6. Builder Storage
- Custom builder elements are stored in `canvas.elements`.
- The `canvas` object remains separate from the AI-generated `html` and `css`.
- Banner exports merge the base template, subject image, and builder overlays at render time.