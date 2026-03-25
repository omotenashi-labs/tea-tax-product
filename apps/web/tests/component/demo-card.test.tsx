/**
 * @file demo-card.test.tsx
 *
 * Component tests for DemoCard — the reusable PWA feature card shell kept
 * for the camera capture flow in the tax demo upload step.
 *
 * These tests exercise the availability/permission display states in a real
 * browser environment via Vitest Browser Mode.
 */

import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import { DemoCard } from '../../src/components/pwa/demo-card';

describe('DemoCard', () => {
  test('renders title and description when feature is available and granted', async () => {
    const screen = render(
      <DemoCard
        title="Camera"
        description="Capture photos"
        icon={<span data-testid="icon">📷</span>}
        featureAvailable={true}
        permissionState="granted"
      >
        <button>Open camera</button>
      </DemoCard>,
    );

    await expect.element(screen.getByText('Camera')).toBeInTheDocument();
    await expect.element(screen.getByText('Capture photos')).toBeInTheDocument();
    await expect.element(screen.getByText('Open camera')).toBeInTheDocument();
  });

  test('renders unavailable state when featureAvailable is false', async () => {
    const screen = render(
      <DemoCard
        title="Microphone"
        description="Record audio"
        icon={<span>🎙</span>}
        featureAvailable={false}
        platformNotes="Not supported in this browser"
      >
        <button>Record</button>
      </DemoCard>,
    );

    await expect.element(screen.getByText('Not available')).toBeInTheDocument();
    // Children should not be rendered when feature is unavailable
    expect(screen.getByText('Record').query()).toBeNull();
  });

  test('renders permission denied message when access is denied', async () => {
    const screen = render(
      <DemoCard
        title="Camera"
        description="Capture photos"
        icon={<span>📷</span>}
        featureAvailable={true}
        permissionState="denied"
      >
        <button>Open camera</button>
      </DemoCard>,
    );

    await expect.element(screen.getByText(/Permission denied/)).toBeInTheDocument();
    expect(screen.getByText('Open camera').query()).toBeNull();
  });

  test('renders grant permission button when permissionState is prompt', async () => {
    const screen = render(
      <DemoCard
        title="Camera"
        description="Capture photos"
        icon={<span>📷</span>}
        featureAvailable={true}
        permissionState="prompt"
      >
        <button>Open camera</button>
      </DemoCard>,
    );

    await expect.element(screen.getByText('Grant permission')).toBeInTheDocument();
    expect(screen.getByText('Open camera').query()).toBeNull();
  });
});
