/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * -2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 *  OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import './dacss';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, LockOpenIcon, ReloadIcon, ScreenshotRegionIcon } from './icons';
import { AnnotateModal } from './annotations';
import { clientToViewport, getImageLayout } from './imageLayout';
import { Recording } from './recording';

import type { Annotation } from './annotations';
import { ToolbarButton } from '@web/components/toolbarButton';
import { useMeasureForRef } from '@web/uiUtils';

import type { DashboardModel } from './dashboardModel';

', 'right'] as const;

async function pickSaveWritable(suggestedName: string, description: string, mime: string, extension: string): Promise<FileSystemWritableFileStream | null> {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description, accept: { [mime]: [extension] } }],
    });
    return await handle.createWritable();
  } catch {
    return null;
  }
}

function smartUrl(input: string): string {
  const value = input.trim();
  if (!value)
    return value;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('about:') || value.startsWith('data:'))
    return value;
  
  const hasDot = host.includes('.');
  const isLocalhost = /^localhost(:\d+)?$/i.test(host);
  const hasPort = /:\d+$/.test(host);
  const isIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);
  if (isLocalhost || isIp || (hasPort && !hasDot))
    return 'http://' + value;
  if (hasDot || hasPort)
    return 'https://' + value;
  return 'https://' + host + '.com' + value.slice(host.length);
}

type DashboardProps = {
  model: DashboardModel;
};

export const Dashboard: React.FC<DashboardProps> = ({ model }) => {
  const [, setRevision] = React.useState(0);
  React.useEffect(() => model.subscribe(() => setRevision(r => r + 1)), [model]);

  const { tabs, mode, recording, liveFrame, annotateFrame, annotateInitiator, pendingAnnotate } = model.state;
  const interactive = mode === 'interactive';

  const [flashTick, setFlashTick] = React.useState(0);

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const viewportMainRef = React.useRef<HTMLDivElement>(null);
  const browserChromeRef = React.useRef<HTMLDivElement>(null);
  const interactiveBtnRef = React.useRef<HTMLButtonElement>(null);
  const moveThrottleRef = React.useRef(0);

  const aspect = liveFrame && liveFrame.viewportWidth && liveFrame.viewportHeight
    ? liveFrame.viewportWidth / liveFrame.viewportHeight
    : null;

  const [viewportRect] = useMeasureForRef(viewportMainRef);

  // Active recording hides the browser chrome so 
  }

  const onSaveRecording = React.useCallback(async (blob: Blob) => {
    const writable = await pickSaveWritable(`playwright-recording-${Date.now()}.webm`, 'WebM Video', 'video/webm', '.webm');
    if (!writable)
      return;
    await writable.write(blob);
    await writable.close();
    model.discardRecording();
  }, [model]);

  const onCloseAnnotate = React.useCallback(() => {
    if (annotateInitiator === 'cli')
      model.completeAnnotation();
    else
      model.cancelAnnotate();
  }, [model, annotateInitiator]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!selectedTab;

  const [omniboxValue, setOmniboxValue] = React.useState(selectedTab?.url ?? '');
  React.useEffect(() => {
    setOmniboxValue(selectedTab?.url ?? '');
  }, [selectedTab?.url]);

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = liveFrame?.viewportWidth ?? 0;
    const vh = liveFrame?.viewportHeight ?? 0;
    if (!vw || !vh)
      return { x: 0, y: 0 };
    const layout = getImageLayout(displayRef.current);
    if (!layout)
      return { x: 0, y: 0 };
    return clientToViewport(layout, vw, vh, e.clientX, e.clientY);
  }

  function sendMouseEvent(method: 'mousedown' | 'mouseup', e: React.MouseEvent) {
    const { x, y } = imgCoords(e);
    model[method](x, y, BUTTONS[e.button] || 'left');
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    screenRef.current?.focus();
    if (!ready)
      return;
    if (!interactive) {
      flashInteractiveHint();
      return;
    }
    sendMouseEvent('mousedown', e);
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    sendMouseEvent('mouseup', e);
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (!interactive)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    model.mousemove(x, y);
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    model.wheel(e.deltaX, e.deltaY);
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    model.keydown(e.key);
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    model.keyup(e.key);
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const value = smartUrl((e.target as HTMLInputElement).value);
      model.navigate(value);
      e.currentTarget.blur();
    }
  }

  const overlayText = selectedTab ? undefined : 'Select a session';
  const isRecording = recording?.phase === 'recording';
  const showAnnotateModal = !!annotateFrame;
  const showRecording = recording?.phase === 'stopped';
  const modeLabel = showAnnotateModal ? 'Dashboard: annotate' : isRecording ? 'Dashboard: record' : 'Dashboard';

  return (
    <main className={'dashboard-view' + (interactive ? ' interactive' : '')} aria-label={modeLabel}>
      {/* Toolbar */}
      <div ref={toolbarRef} className='toolbar'>
        <ToolbarButton
          ref={interactiveBtnRef}
          className='mode-toggle mode-interactive'
          title={interactive ? 'Disable interactive mode' : 'Enable interactive mode'}
          toggled={interactive}
          disabled={!ready}
          onClick={() => {
            if (interactive)
              model.toggleInteractive();
            else
              model.enterInteractive();
          }}
        >
          {interactive ? <LockOpenIcon /> : <LockIcon />}
        </ToolbarButton>
        <ToolbarButton
          className='mode-annotate'
          title='Annotate screenshot'
          disabled={!ready || !!pendingAnnotate || showAnnotateModal}
          onClick={() => model.enterAnnotate('user')}
        >
          <ScreenshotRegionIcon />
        </ToolbarButton>
        <ToolbarButton
          className='mode-toggle mode-record'
          title={isRecording ? 'Stop recording' : 'Record video'}
          icon='record'
          toggled={isRecording}
          disabled={!ready || showRecording}
          onClick={() => {
            if (isRecording)
              model.stopRecording();
            else
              model.startRecording();
          }}
        >
          {isRecording && <span className='mode-record-label'>Recording...</span>}
        </ToolbarButton>
      </div>

      {/* Viewport */}
      <div className='viewport-wrapper'>
        <div ref={viewportMainRef} className='viewport-main'>
          <div className='browser-window' style={windowStyle}>
            {showBrowserChrome && (
              <div ref={browserChromeRef} className='browser-chrome'>
                <button className='nav-btn' title='Back' aria-disabled={!interactive || undefined} onClick={() => {
                  if (!interactive) {
                    flashInteractiveHint();
                    return;
                  }
                  model.back();
                }}>
                  <ChevronLeftIcon />
                </button>
                <button className='nav-btn' title='Forward' aria-disabled={!interactive || undefined} onClick={() => {
                  if (!interactive) {
                    flashInteractiveHint();
                    return;
                  }
                  model.forward();
                }}>
                  <ChevronRightIcon />
                </button>
                <button className='nav-btn' title='Reload' aria-disabled={!interactive || undefined} onClick={() => {
                  if (!interactive) {
                    flashInteractiveHint();
                    return;
                  }
                  model.reload();
                }}>
                  <ReloadIcon />
                </button>
                <div className='omnibox-wrap'>
                  <input
                    id='omnibox'
                    className='omnibox'
                    type='text'
                    placeholder='Search or enter URL'
                    spellCheck={false}
                    autoComplete='off'
                    value={omniboxValue}
                    onChange={e => setOmniboxValue(e.target.value)}
                    onKeyDown={e => {
                      if (!interactive)
                        return;
                      onOmniboxKeyDown(e);
                    }}
                    onFocus={e => {
                      if (!interactive) {
                        flashInteractiveHint();
                        e.target.blur();
                        return;
                      }
                      e.target.select();
                    }}
                    aria-disabled={!interactive || undefined}
                    readOnly={!interactive}
                  />
                </div>
              </div>
            )}
            <div
              ref={screenRef}
              className='screen'
              tabIndex={

      {showRecording && recording?.phase === 'stopped' && (
        <Recording
          blob={recording.blob}
          blobUrl={recording.blobUrl}
          onSave={onSaveRecording}
          onClose={() => model.discardRecording()}
        />
      )}
    </main>
  );
};
