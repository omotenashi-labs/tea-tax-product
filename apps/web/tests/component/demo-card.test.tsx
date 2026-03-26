/**
 * @file demo-card.test.tsx
 *
 * Component tests for DemoCard — the reusable PWA feature card shell kept
 * for the camera capture flow in the tax demo upload step.
 *
 * These tests exercise the availability/permission display states in a real
 * browser environment via Vitest Browser Mode.
 */

import React from 'react';
import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import { Camera, Mic, Lock, HelpCircle } from 'lucide-react';
import { DemoCard } from '../../src/components/pwa/demo-card';

describe('DemoCard', () => {
  test('renders heading and description when feature is available and granted', async () => {
    const screen = render(
      <DemoCard
        title="CaptureCard"
        description="Take a photo with the device camera"
        icon={<Camera size={20} data-testid="icon" />}
        featureAvailable={true}
        permissionState="granted"
      >
        <button>Shoot</button>
      </DemoCard>,
    );

    await expect.element(screen.getByRole('heading', { name: 'CaptureCard' })).toBeInTheDocument();
    await expect
      .element(screen.getByText('Take a photo with the device camera'))
      .toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Shoot' })).toBeInTheDocument();
  });

  test('renders unavailable state when featureAvailable is false and hides children', async () => {
    const screen = render(
      <DemoCard
        title="MicrophoneCard"
        description="Record audio"
        icon={<Mic size={20} />}
        featureAvailable={false}
        platformNotes="Not supported in this browser"
      >
        <button>StartRecording</button>
      </DemoCard>,
    );

    await expect.element(screen.getByText('Not available')).toBeInTheDocument();
    // Children must not be rendered when the feature is unavailable
    await expect
      .element(screen.getByRole('button', { name: 'StartRecording' }))
      .not.toBeInTheDocument();
  });

  test('renders permission denied message when access is denied', async () => {
    const screen = render(
      <DemoCard
        title="DeniedCard"
        description="Permission test"
        icon={<Lock size={20} />}
        featureAvailable={true}
        permissionState="denied"
      >
        <button>ActionDenied</button>
      </DemoCard>,
    );

    await expect.element(screen.getByText(/Permission denied/)).toBeInTheDocument();
    await expect
      .element(screen.getByRole('button', { name: 'ActionDenied' }))
      .not.toBeInTheDocument();
  });

  test('renders grant permission button when permissionState is prompt', async () => {
    const screen = render(
      <DemoCard
        title="PromptCard"
        description="Needs permission"
        icon={<HelpCircle size={20} />}
        featureAvailable={true}
        permissionState="prompt"
      >
        <button>ActionPrompt</button>
      </DemoCard>,
    );

    await expect
      .element(screen.getByRole('button', { name: 'Grant permission' }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole('button', { name: 'ActionPrompt' }))
      .not.toBeInTheDocument();
  });
});
