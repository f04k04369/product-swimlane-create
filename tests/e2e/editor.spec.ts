import { expect, test } from '@playwright/test';

test.describe('Swimlane editor', () => {
  test('loads canvas and supports lane and export actions', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Swimlane Studio' })).toBeVisible();

    const laneCards = page.getByTestId('lane-card');
    const initialLaneCount = await laneCards.count();

    await page.getByRole('button', { name: 'レーンを追加' }).click();
    await expect(page.getByTestId('lane-card')).toHaveCount(initialLaneCount + 1);

    const stepNodes = page.getByTestId('step-node');
    const initialStepCount = await stepNodes.count();
    await page.getByRole('button', { name: '標準ステップ' }).click();
    await expect(page.getByTestId('step-node')).toHaveCount(initialStepCount + 1);

    await page.getByRole('button', { name: '条件分岐' }).click();
    await expect(page.getByTestId('step-node')).toHaveCount(initialStepCount + 2);

    await page.getByRole('button', { name: 'ステップパネル隠す' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'ステップ編集' })).toHaveCount(0);
    await page.getByRole('button', { name: 'ステップパネル表示' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'ステップ編集' })).toBeVisible();

    await page.getByRole('button', { name: 'Mermaid入出力' }).click();
    const modal = page.getByRole('dialog', { name: 'Mermaidエクスポート / インポート' });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('textbox').first()).toContainText('flowchart TD');
    await modal.getByRole('button', { name: '閉じる' }).click();
    await expect(modal).toBeHidden();
  });
});
