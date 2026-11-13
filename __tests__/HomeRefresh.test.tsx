/**
 * @format
 */

import React from 'react';
import {RefreshControl, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {HomeScreen} from '../src/screens/HomeScreen';

jest.mock('react-native-encrypted-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));
jest.mock('react-native-image-picker', () => ({launchImageLibrary: jest.fn()}));

const noop = () => {};

async function renderHome(props: Partial<React.ComponentProps<typeof HomeScreen>>) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <HomeScreen
        link="online"
        balanceSat={1000}
        balanceIsCached={false}
        balanceAt={null}
        onRefresh={noop}
        onPullRefresh={async () => {}}
        onSend={noop}
        onReceive={noop}
        onUnpair={noop}
        {...props}
      />,
    );
  });
  return tree;
}

const refreshControl = (tree: ReactTestRenderer.ReactTestRenderer) => tree.root.findByType(RefreshControl);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('trascinando giù si aggiorna una volta sola e la rotellina resta finché il nodo non ha risposto', async () => {
  let answer!: () => void;
  const onPullRefresh = jest.fn(() => new Promise<void>(r => (answer = r)));
  const tree = await renderHome({onPullRefresh});
  expect(refreshControl(tree).props.refreshing).toBe(false);

  await ReactTestRenderer.act(async () => {
    refreshControl(tree).props.onRefresh();
    // Un secondo trascinamento mentre il primo è in corso non fa partire un altro aggiornamento.
    refreshControl(tree).props.onRefresh();
  });
  expect(onPullRefresh).toHaveBeenCalledTimes(1);
  expect(refreshControl(tree).props.refreshing).toBe(true);

  // Il nodo non ha ancora risposto: passato il tempo minimo la rotellina gira ancora.
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(refreshControl(tree).props.refreshing).toBe(true);

  await ReactTestRenderer.act(async () => {
    answer();
  });
  expect(refreshControl(tree).props.refreshing).toBe(false);
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('se il nodo risponde subito la rotellina resta comunque visibile un attimo', async () => {
  const tree = await renderHome({});
  await ReactTestRenderer.act(async () => {
    refreshControl(tree).props.onRefresh();
  });
  expect(refreshControl(tree).props.refreshing).toBe(true);
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(600);
  });
  expect(refreshControl(tree).props.refreshing).toBe(false);
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('se l’aggiornamento fallisce la rotellina si ferma lo stesso', async () => {
  const tree = await renderHome({onPullRefresh: () => Promise.reject(new Error('nodo spento'))});
  await ReactTestRenderer.act(async () => {
    refreshControl(tree).props.onRefresh().catch(noop);
    jest.advanceTimersByTime(600);
  });
  expect(refreshControl(tree).props.refreshing).toBe(false);
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('senza nodo Ricevi e Invia sono spenti, il QR no', async () => {
  const tree = await renderHome({link: 'offline'});
  const button = (label: RegExp) =>
    tree.root.find(n => typeof n.props.onPress === 'function' && label.test(n.props.accessibilityLabel ?? ''));
  expect(button(/^Ricevi$/).props.disabled).toBe(true);
  expect(button(/^Invia$/).props.disabled).toBe(true);
  expect(button(/QR/).props.disabled).toBeFalsy();
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('toccando la bolla del saldo: sat, poi euro, poi nascosto senza unità', async () => {
  const onRefresh = jest.fn();
  const tree = await renderHome({onRefresh, balanceSat: 1234567});
  const bubble = () => tree.root.find(n => typeof n.props.onPress === 'function' && /^Saldo/.test(n.props.accessibilityLabel ?? ''));
  const texts = () =>
    bubble()
      .findAllByType(Text)
      .map(t => t.props.children);

  expect(bubble().props.accessibilityLabel).toBe('Saldo in sat');
  expect(texts()).toEqual(['1.234.567', 'sat']);

  await ReactTestRenderer.act(async () => bubble().props.onPress());
  expect(bubble().props.accessibilityLabel).toBe('Saldo in euro');
  // Ogni tocco coglie l'occasione per controllare il collegamento al nodo.
  expect(onRefresh).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => bubble().props.onPress());
  expect(bubble().props.accessibilityLabel).toBe('Saldo nascosto');
  // Nascosto: solo gli asterischi, la bolla si accorcia.
  expect(texts()).toEqual(['******']);
  await ReactTestRenderer.act(async () => tree.unmount());
});
