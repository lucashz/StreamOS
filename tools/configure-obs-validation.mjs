import './lib/e2e-invites.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const api = process.env.API_URL ?? 'http://localhost:3001';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${api}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `${options.method ?? 'GET'} ${path}: ${JSON.stringify(body)}`,
    );
  return { response, body };
}

async function createValidationWidgets() {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const registration = await apiRequest('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `obs-validation-${suffix}@streamos.local`,
      password: 'StreamOS-OBS-Validation-123!',
      displayName: 'Validação OBS',
      acceptTerms: true,
    }),
  });
  const cookie = registration.response.headers.getSetCookie()[0]?.split(';')[0];
  if (!cookie) throw new Error('A API não retornou a sessão de validação');

  const definitions = [
    ['ALERT', 'StreamOS — Alertas'],
    ['SONG_PIX', 'StreamOS — SongPix'],
    ['VIDEO_PIX', 'StreamOS — VideoPix'],
  ];
  const widgets = [];
  for (const [type, name] of definitions) {
    const created = await apiRequest('/dashboard/widgets', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type, name }),
    });
    widgets.push({
      id: created.body.id,
      type,
      name,
      url: created.body.browserSourceUrl,
    });
  }
  return { cookie, widgets };
}

async function obsConnection() {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error('APPDATA não está definido');
  const config = JSON.parse(
    await readFile(
      join(
        appData,
        'obs-studio',
        'plugin_config',
        'obs-websocket',
        'config.json',
      ),
      'utf8',
    ),
  );
  const socket = new WebSocket(`ws://127.0.0.1:${config.server_port ?? 4455}`);
  const pending = new Map();
  let sequence = 0;

  const identified = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timeout conectando ao OBS')),
      10_000,
    );
    socket.addEventListener('error', () =>
      reject(new Error('WebSocket do OBS recusou a conexão')),
    );
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.op === 0) {
        const authentication = message.d.authentication;
        let response;
        if (authentication) {
          const secret = createHash('sha256')
            .update(`${config.server_password}${authentication.salt}`)
            .digest('base64');
          response = createHash('sha256')
            .update(`${secret}${authentication.challenge}`)
            .digest('base64');
        }
        socket.send(
          JSON.stringify({
            op: 1,
            d: {
              rpcVersion: 1,
              ...(response ? { authentication: response } : {}),
            },
          }),
        );
      } else if (message.op === 2) {
        clearTimeout(timeout);
        resolve();
      } else if (message.op === 7) {
        const request = pending.get(message.d.requestId);
        if (!request) return;
        pending.delete(message.d.requestId);
        if (message.d.requestStatus.result)
          request.resolve(message.d.responseData ?? {});
        else
          request.reject(
            new Error(
              `${message.d.requestStatus.code}: ${message.d.requestStatus.comment}`,
            ),
          );
      }
    });
  });
  await identified;

  return {
    async call(requestType, requestData = {}) {
      const requestId = `streamos-${++sequence}`;
      const result = new Promise((resolve, reject) =>
        pending.set(requestId, { resolve, reject }),
      );
      socket.send(
        JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }),
      );
      return result;
    },
    close() {
      socket.close();
    },
  };
}

const validation = await createValidationWidgets();
const obs = await obsConnection();
try {
  const scenes = await obs.call('GetSceneList');
  const sceneName = scenes.currentProgramSceneName;
  const inputs = await obs.call('GetInputList');
  const existingNames = new Set(inputs.inputs.map((input) => input.inputName));

  for (const widget of validation.widgets) {
    const inputSettings = {
      url: widget.url,
      width: 1920,
      height: 1080,
      reroute_audio: true,
      shutdown: false,
      restart_when_active: true,
    };
    if (existingNames.has(widget.name)) {
      await obs.call('SetInputSettings', {
        inputName: widget.name,
        inputSettings,
        overlay: true,
      });
    } else {
      await obs.call('CreateInput', {
        sceneName,
        inputName: widget.name,
        inputKind: 'browser_source',
        inputSettings,
        sceneItemEnabled: true,
      });
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  const outputDirectory = join(process.cwd(), '.runtime', 'obs-validation');
  await mkdir(outputDirectory, { recursive: true });
  const ratios = [
    ['16x9', 1920, 1080],
    ['9x16', 1080, 1920],
    ['1x1', 1080, 1080],
  ];
  const evidence = [];
  for (const widget of validation.widgets) {
    await apiRequest(`/dashboard/widgets/${widget.id}/test`, {
      method: 'POST',
      headers: { cookie: validation.cookie },
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const volume = await obs.call('GetInputVolume', { inputName: widget.name });
    for (const [ratio, width, height] of ratios) {
      await obs.call('SetInputSettings', {
        inputName: widget.name,
        inputSettings: { width, height },
        overlay: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
      const screenshot = await obs.call('GetSourceScreenshot', {
        sourceName: widget.name,
        imageFormat: 'png',
        imageWidth: width,
        imageHeight: height,
        imageCompressionQuality: 100,
      });
      const path = join(
        outputDirectory,
        `${widget.type.toLowerCase()}-${ratio}.png`,
      );
      await writeFile(
        path,
        Buffer.from(screenshot.imageData.split(',')[1], 'base64'),
      );
      evidence.push(path);
    }
    await obs.call('SetInputSettings', {
      inputName: widget.name,
      inputSettings: { width: 1920, height: 1080 },
      overlay: true,
    });
    widget.volumeDb = volume.inputVolumeDb;
  }
  await apiRequest('/dashboard/alerts/test', {
    method: 'POST',
    headers: {
      cookie: validation.cookie,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sequence: true }),
  });
  console.log(
    JSON.stringify(
      {
        result: 'ok',
        sceneName,
        sources: validation.widgets.map(({ name, type, volumeDb }) => ({
          name,
          type,
          audioRoutedToMixer: Number.isFinite(volumeDb),
        })),
        evidence,
        alertSequenceSent: true,
      },
      null,
      2,
    ),
  );
} finally {
  obs.close();
}
