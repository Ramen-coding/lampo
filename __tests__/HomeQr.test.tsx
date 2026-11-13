/**
 * @format
 */

import React from 'react';
import {Image} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {HomeScreen} from '../src/screens/HomeScreen';

const mockStore: Record<string, string> = {};
jest.mock('react-native-encrypted-storage', () => ({
  getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockStore[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete mockStore[k];
  }),
}));

const mockLaunch = jest.fn();
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...args: unknown[]) => mockLaunch(...args),
}));

const noop = () => {};

async function renderHome() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <HomeScreen
        link="offline"
        balanceSat={1000}
        balanceIsCached={false}
        balanceAt={null}
        onRefresh={noop}
        onSend={noop}
        onReceive={noop}
        onUnpair={noop}
      />,
    );
  });
  return tree;
}

const qrButton = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    n => typeof n.props.onPress === 'function' && /QR/.test(n.props.accessibilityLabel ?? '') && n.props.hitSlop === 8,
  );

const shownQr = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Image).map(i => i.props.source?.uri);

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockLaunch.mockReset();
});

test('il tasto QR apre la galleria la prima volta, poi mostra l’immagine salvata', async () => {
  mockLaunch.mockResolvedValue({assets: [{base64: 'QUJD', type: 'image/png'}]});
  const tree = await renderHome();
  expect(shownQr(tree)).toEqual([]);

  // Funziona anche con il nodo non raggiungibile: non apre più la fotocamera.
  expect(qrButton(tree).props.disabled).toBeFalsy();
  await ReactTestRenderer.act(async () => qrButton(tree).props.onPress());

  expect(mockLaunch).toHaveBeenCalledTimes(1);
  expect(mockLaunch.mock.calls[0][0]).toMatchObject({mediaType: 'photo', selectionLimit: 1});
  expect(shownQr(tree)).toEqual(['data:image/png;base64,QUJD']);
  expect(mockStore.home_qr_image_v1).toBe('data:image/png;base64,QUJD');

  // Alla riapertura l'immagine è ancora lì: il tasto la mostra senza riaprire la galleria.
  const again = await renderHome();
  await ReactTestRenderer.act(async () => qrButton(again).props.onPress());
  expect(mockLaunch).toHaveBeenCalledTimes(1);
  expect(shownQr(again)).toEqual(['data:image/png;base64,QUJD']);
});

test('galleria annullata: non si salva e non si mostra niente', async () => {
  mockLaunch.mockResolvedValue({didCancel: true});
  const tree = await renderHome();
  await ReactTestRenderer.act(async () => qrButton(tree).props.onPress());
  expect(shownQr(tree)).toEqual([]);
  expect(mockStore.home_qr_image_v1).toBeUndefined();
});
