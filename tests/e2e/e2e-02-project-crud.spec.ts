import { test, expect, chromium } from '@playwright/test';
import { launchExtension, getExtensionId, openOptions } from './fixtures';

/**
 * E2E-02 — Project CRUD Lifecycle
 *
 * Create, read, update, and delete a project through the Options page.
 *
 * Implementation notes
 * --------------------
 * - The Options page renders <OnboardingFlow /> when
 *   `marco_onboarding_complete` is not set in `chrome.storage.local`. Every
 *   CRUD test must seed that flag *before* the Options page loads, otherwise
 *   the dashboard never mounts and queries like `getByRole('button',
 *   { name: /new project/i })` time out.
 * - The "New Project" trigger comes from `ProjectsListView` (button label
 *   "New Project"). The form lives in `ProjectCreateForm` (placeholder
 *   "Project name", save button "Create") — see those components if
 *   selectors drift.
 *
 * Priority: P0 | Auto: ✅ | Est: 3 min
 */

async function seedOnboardingComplete(context: import('@playwright/test').BrowserContext, extensionId: string) {
  // Open a throwaway extension page so we can write to chrome.storage.local
  // *before* the test's Options page boot reads the onboarding flag.
  const seedPage = await context.newPage();
  await seedPage.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await seedPage.evaluate(async () => {
    await new Promise<void>(resolve =>
      chrome.storage.local.set({ marco_onboarding_complete: true }, () => resolve()),
    );
  });
  await seedPage.close();
}

test.describe('E2E-02 — Project CRUD Lifecycle', () => {
  test('create a new project', async () => {
    const context = await launchExtension(chromium);
    const extensionId = await getExtensionId(context);
    await seedOnboardingComplete(context, extensionId);
    const options = await openOptions(context, extensionId);

    // ProjectsListView exposes a "New Project" button. Match exactly so we
    // do not collide with "New Script" / "New Config" buttons elsewhere.
    await options.getByRole('button', { name: /^new project$/i }).click();

    // ProjectCreateForm uses placeholders, not <label htmlFor>. Use
    // getByPlaceholder so the selector tracks the actual DOM.
    await options.getByPlaceholder(/project name/i).fill('Test Automation');

    // The save CTA is labeled "Create" (see ProjectCreateForm.tsx:212).
    await options.getByRole('button', { name: /^create$/i }).click();

    await expect(options.getByText('Test Automation').first()).toBeVisible();

    await context.close();
  });

  test('update project name', async () => {
    const context = await launchExtension(chromium);
    const extensionId = await getExtensionId(context);
    await seedOnboardingComplete(context, extensionId);
    const options = await openOptions(context, extensionId);

    // Setup
    await options.getByRole('button', { name: /^new project$/i }).click();
    await options.getByPlaceholder(/project name/i).fill('Test Automation');
    await options.getByRole('button', { name: /^create$/i }).click();

    // Navigate to project detail. The project card uses the same text as
    // the H2 inside the detail view, so use .first() to disambiguate.
    await options.getByText('Test Automation').first().click();

    // ProjectDetailView renders the name as a click-to-edit <h2>. We must
    // click it to mount the underlying <Input placeholder="Project name">
    // — otherwise getByPlaceholder will time out.
    await options.getByRole('heading', { name: 'Test Automation' }).click();

    const nameInput = options.getByPlaceholder(/project name/i);
    await nameInput.clear();
    await nameInput.fill('Test Automation v2');

    // Press Enter to commit edit, then click the "Save project" icon button
    // (rendered only when isDirty=true). aria-label was added so it's
    // discoverable by getByRole.
    await nameInput.press('Enter');
    await options.getByRole('button', { name: /save project/i }).click();

    await expect(options.getByText('Test Automation v2').first()).toBeVisible();

    await context.close();
  });

  test('delete project cleans up storage', async () => {
    const context = await launchExtension(chromium);
    const extensionId = await getExtensionId(context);
    await seedOnboardingComplete(context, extensionId);
    const options = await openOptions(context, extensionId);

    await options.getByRole('button', { name: /^new project$/i }).click();
    await options.getByPlaceholder(/project name/i).fill('Delete Me');
    await options.getByRole('button', { name: /^create$/i }).click();

    await options.getByText('Delete Me').first().click();

    // ProjectHeader's delete trigger is an icon-only button. The aria-label
    // ("Delete project") was added on IconButtonWithTooltip so role queries
    // can find it without relying on visible text.
    await options.getByRole('button', { name: /delete project/i }).click();

    // Confirmation dialog uses an AlertDialogAction labeled "Delete".
    await options.getByRole('button', { name: /^delete$/i }).click();

    await expect(options.getByText('Delete Me')).not.toBeVisible();

    await context.close();
  });
});
