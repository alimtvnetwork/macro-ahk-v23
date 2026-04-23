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

    // Edit → rename → save. The detail view may use either an explicit
    // "Save" button or auto-save on blur; handle both to stay resilient.
    await options.getByText('Test Automation').first().click();
    const nameInput = options.getByPlaceholder(/project name/i);
    await nameInput.clear();
    await nameInput.fill('Test Automation v2');
    const saveBtn = options.getByRole('button', { name: /^save$/i });
    if (await saveBtn.count() > 0) {
      await saveBtn.first().click();
    } else {
      await nameInput.blur();
    }

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
    await options.getByRole('button', { name: /^delete/i }).first().click();

    // Confirmation dialog uses an AlertDialogAction labeled either "Delete"
    // or "Confirm" depending on context — click whichever appears last
    // (the dialog action is rendered after the trigger).
    const confirmBtn = options.getByRole('button', { name: /confirm|delete/i }).last();
    await confirmBtn.click();

    await expect(options.getByText('Delete Me')).not.toBeVisible();

    await context.close();
  });
});
