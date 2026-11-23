import { browser, expect } from '@wdio/globals';
import { describe, it } from 'mocha';

describe('MinerU View E2E', function () {
	it('loads the mineru-view plugin cleanly', async function () {
		const enabled = await browser.executeObsidian(({ app }) => {
			const plugins = (app as unknown as { plugins: { enabledPlugins: Set<string> } }).plugins;
			return plugins.enabledPlugins.has('mineru-view');
		});
		expect(enabled).toBe(true);
	});

	it('toggles reading-order arrows setting via command', async function () {
		const initial = await browser.executeObsidian(({ app }) => {
			const plugin = (app as unknown as { plugins: { plugins: Record<string, { settings: { showArrows: boolean } }> } }).plugins.plugins['mineru-view'];
			return plugin?.settings.showArrows;
		});

		await browser.executeObsidianCommand('mineru-view:toggle-reading-order-arrows');

		const toggled = await browser.executeObsidian(({ app }) => {
			const plugin = (app as unknown as { plugins: { plugins: Record<string, { settings: { showArrows: boolean } }> } }).plugins.plugins['mineru-view'];
			return plugin?.settings.showArrows;
		});
		expect(typeof initial).toBe('boolean');
		expect(toggled).toBe(!initial);
	});

	it('registers its settings tab', async function () {
		const hasTab = await browser.executeObsidian(({ app }) => {
			const setting = (app as unknown as { setting?: { pluginTabs?: { id: string }[] } }).setting;
			return Boolean(setting?.pluginTabs?.some((tab) => tab.id === 'mineru-view'));
		});
		expect(hasTab).toBe(true);
	});
});
